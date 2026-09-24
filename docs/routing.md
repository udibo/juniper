# Routing

## File-Based Routing

Juniper uses file-based routing where the file structure in your `routes`
directory directly maps to URL paths.

### Route Files

Routes are defined using two types of files:

- **`.ts` files** - Server-side route logic (loaders, actions, middleware, Hono
  configuration)
- **`.tsx` files** - React components for rendering

A complete route typically has both files:

```
routes/
├── main.ts       # Root server configuration
├── main.tsx      # Root layout component
├── blog/
│   ├── index.ts  # Blog list loader
│   └── index.tsx # Blog list component
```

### Route Naming Conventions

| File                         | URL Path    | Description     |
| ---------------------------- | ----------- | --------------- |
| `routes/index.tsx`           | `/`         | Home page       |
| `routes/about.tsx`           | `/about`    | Static page     |
| `routes/blog/index.tsx`      | `/blog`     | Blog list       |
| `routes/blog/[id]/index.tsx` | `/blog/:id` | Dynamic route   |
| `routes/docs/[...].tsx`      | `/docs/*`   | Catch-all route |
| `routes/api/main.ts`         | `/api`      | Route group     |

### Index Routes

An `index.tsx` file renders at the parent path:

```
routes/
├── blog/
│   ├── index.ts     # Loader for /blog
│   ├── index.tsx    # Component for /blog
│   ├── create.tsx   # Component for /blog/create
│   └── [id]/
│       └── index.tsx  # Component for /blog/:id
```

### Dynamic Routes

Use square brackets for dynamic segments:

```
routes/blog/[id]/index.tsx  → /blog/:id
routes/users/[userId]/posts/[postId].tsx  → /users/:userId/posts/:postId
```

Access parameters in your components and loaders:

```tsx
// routes/blog/[id]/index.tsx
import type { RouteProps } from "@udibo/juniper";

interface BlogPostLoaderData {
  post: Post;
}

export default function BlogPost({
  params,
  loaderData,
}: RouteProps<{ id: string }, BlogPostLoaderData>) {
  return <h1>{loaderData.post.title}</h1>;
}
```

### Catch-All Routes

Use `[...].tsx` for catch-all routes that match any path:

```
routes/docs/[...].tsx  → /docs/* (matches /docs/a, /docs/a/b, etc.)
```

The matched path is available as `params["*"]`:

```tsx
export default function DocsPage({ params }: RouteProps) {
  const path = params["*"]; // e.g., "getting-started/installation"
  return <div>Docs: {path}</div>;
}
```

### Route Groups

A `main.ts` file creates a route group with shared configuration:

```
routes/
├── api/
│   ├── main.ts      # API route group configuration
│   ├── users.ts     # /api/users endpoint
│   └── posts.ts     # /api/posts endpoint
```

Route groups can define shared middleware and Hono routes.

## Route Modules

### Server Routes (main.ts)

The `main.ts` file exports a Hono application and optional route configuration:

```typescript
// routes/main.ts
import { Hono } from "hono";
import { logger } from "hono/logger";
import type { AppEnv } from "@udibo/juniper/server";

const app = new Hono<AppEnv>();

// Add middleware
app.use(logger());

// Set context values for all routes
app.use(async (c, next) => {
  const context = c.get("context");
  context.set(userContext, await getUser(c.req));
  await next();
});

// Optional: Define which environment variables are public
export const publicEnvKeys = ["API_URL"];

export default app;
```

Context values set here are automatically serialized to the client if registered
with `registerContext`. See
[State Management](state-management.md#sharing-server-context-with-the-client)
for details.

### Client Routes (main.tsx)

The `.tsx` files define React components and client-side behavior:

```tsx
// routes/main.tsx
import { Outlet } from "react-router";
import type { ErrorBoundaryProps } from "@udibo/juniper";

export default function Main() {
  return (
    <main>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <nav>...</nav>
      <Outlet />
    </main>
  );
}

export function ErrorBoundary(
  { error, resetErrorBoundary }: ErrorBoundaryProps,
) {
  return (
    <div>
      <h1>Error</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
```

### Route Module Exports

A route module can export:

| Export             | Type      | Description                                       |
| ------------------ | --------- | ------------------------------------------------- |
| `default`          | Component | The React component to render                     |
| `loader`           | Function  | Fetches data before rendering                     |
| `action`           | Function  | Handles form submissions                          |
| `middleware`       | Array     | Runs before loaders/actions (client `.tsx` only)  |
| `ErrorBoundary`    | Component | Displays errors for this route                    |
| `HydrateFallback`  | Component | Shows while deferred route data is unresolved     |
| `shouldRevalidate` | Function  | Decides if the loader reruns (client `.tsx` only) |
| `beforeHydrate`    | Function  | Runs before React hydrates (root `main.tsx` only) |

Export `publicEnvKeys` from the root **server** module, `routes/main.ts`, to
allowlist additional environment values in hydration data. See
[configuration](configuration.md#public-environment-variables).

Juniper carries JSON-shaped data, `undefined`, `Date`, `Error`, `bigint`, and
promises through one tagged JSON codec. Client data responses carry
`X-Juniper: data`: settled values use JSON and deferred values stream as NDJSON.
See [How Values Travel](state-management.md#how-values-travel). Register other
classes with `registerType`; unregistered objects do not retain their class
identity.

### Layout Wrapper Pattern

When you want a route's default component, `ErrorBoundary`, and/or
`HydrateFallback` to share the same layout, use a separate layout component that
wraps the content in each export. This gives normal, error, and loading states a
consistent visual structure. It does not guarantee that a shared component stays
mounted: switching to an error boundary replaces the normal route subtree. Put
state that must survive a child error in an ancestor outside that boundary.

Keep providers available in every state that needs them. The following example
shares a layout across each export:

```tsx
// routes/main.tsx
import { HttpError } from "@udibo/juniper";
import type { ErrorBoundaryProps } from "@udibo/juniper";
import { Outlet } from "react-router";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <link rel="stylesheet" href="/build/main.css" precedence="default" />
      <nav>...</nav>
      <main>{children}</main>
    </>
  );
}

export default function Main() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export function ErrorBoundary(
  { error, resetErrorBoundary }: ErrorBoundaryProps,
) {
  return (
    <Layout>
      <h1>Something went wrong</h1>
      <p>
        {error instanceof HttpError
          ? error.exposedMessage
          : "Please try again later."}
      </p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </Layout>
  );
}

export function HydrateFallback() {
  return (
    <Layout>
      <p>Loading...</p>
    </Layout>
  );
}
```

This pattern can be used on any route, not just the root route. For example, a
blog section might have its own layout:

```tsx
// routes/blog/main.tsx
import type { ErrorBoundaryProps } from "@udibo/juniper";
import { Link, Outlet } from "react-router";

function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto">
      <nav className="mb-8">
        <Link to="/blog">All Posts</Link>
        <Link to="/blog/create">New Post</Link>
      </nav>
      {children}
    </div>
  );
}

export default function BlogMain() {
  return (
    <BlogLayout>
      <Outlet />
    </BlogLayout>
  );
}

export function ErrorBoundary(
  { error, resetErrorBoundary }: ErrorBoundaryProps,
) {
  return (
    <BlogLayout>
      <h1>Blog Error</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </BlogLayout>
  );
}
```

## Data Loading

### Server Loaders

Loaders fetch data before rendering a route. They always run on the server.
Loader data is automatically serialized when sent to the client. Use
[serializable values](state-management.md#serializable-values), and register
custom classes rather than relying on their prototype surviving the transfer.

- **Initial page load (SSR)**: The loader runs on the server and the data is
  included in the HTML response.
- **Client-side navigation**: When navigating between routes, the client makes a
  request to the server to run the loader and fetch the data.

```typescript
// routes/blog/[id]/index.ts
import { HttpError } from "@udibo/juniper";
import type { RouteLoaderArgs } from "@udibo/juniper";
import { postService } from "@/services/post.ts";

interface BlogPostLoaderData {
  post: Post;
}

export async function loader({
  params,
  request,
}: RouteLoaderArgs<{ id: string }, BlogPostLoaderData>): Promise<
  BlogPostLoaderData
> {
  const post = await postService.get(params.id);

  if (!post) {
    throw new HttpError(404, "Post not found");
  }

  return { post };
}
```

### Accessing Loader Data

Access loader data in your component via the `loaderData` prop:

```tsx
// routes/blog/[id]/index.tsx
import type { RouteProps } from "@udibo/juniper";

interface BlogPostLoaderData {
  post: Post;
}

export default function BlogPost({
  loaderData,
}: RouteProps<{ id: string }, BlogPostLoaderData>) {
  return (
    <article>
      <h1>{loaderData.post.title}</h1>
      <p>{loaderData.post.content}</p>
    </article>
  );
}
```

### Deferred Data

For data that can load after the initial render, return promises:

```typescript
// routes/dashboard/index.ts
interface DashboardLoaderData {
  user: User;
  analytics: Promise<Analytics>; // Deferred
  notifications: Promise<Notification[]>; // Deferred
}

export function loader({ context }: RouteLoaderArgs): DashboardLoaderData {
  const user = context.get(userContext);

  return {
    user,
    // These load in parallel, don't block initial render
    analytics: fetchAnalytics(user.id),
    notifications: fetchNotifications(user.id),
  };
}
```

Use `Suspense` and `Await` to render deferred data:

```tsx
import { Suspense } from "react";
import { Await } from "react-router";

export default function Dashboard({ loaderData }: RouteProps) {
  return (
    <div>
      <h1>Welcome, {loaderData.user.name}</h1>

      <Suspense fallback={<p>Loading analytics...</p>}>
        <Await resolve={loaderData.analytics}>
          {(analytics) => <AnalyticsChart data={analytics} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

On a first page load, the page hydrates without waiting for deferred promises;
each value reaches `Await` as its promise settles on the server. See
[How Values Travel](state-management.md#how-values-travel).

#### Crawlers and Browsers Without JavaScript

Browsers always receive a streamed document. It shows each `Suspense` fallback
first and swaps the content in with an inline script once the promise settles. A
browser with JavaScript disabled never runs that script, so it keeps the
fallback and never shows the deferred content. Deferred sections therefore need
JavaScript to be read. When a reader without JavaScript needs some data, such as
the main content of a page or anything a form depends on, await it in the loader
instead of returning it as a promise.

Crawlers, detected by their user agent, receive a complete document instead. The
server waits for the deferred promises before it sends any HTML, and each
settled section is written in place however large the page is. Error documents
follow the same rule. The exception is a section that renders a stylesheet with
`precedence`: React always sends that section after its fallback and reveals it
with a script once the stylesheet loads. Load stylesheets outside deferred
sections, for example in the root layout.

A crawler's document waits at most 10 seconds. When that passes, the promises
still pending are sent as their `Suspense` fallbacks and the response ends, so a
promise that never settles cannot hold the request open. A section that timed
out does not recover if the page is later hydrated. Its value is never sent, so
when the document ends the client rejects that promise with
`Unexpected end of document before all promises resolved`. The page then shows
that `Await`'s `errorElement`, or the route's error boundary if the `Await` has
none. Give every deferred section an `errorElement` so a failure affects only
that section:

```tsx
<Suspense fallback={<p>Loading analytics...</p>}>
  <Await
    resolve={loaderData.analytics}
    errorElement={<p>Analytics are unavailable.</p>}
  >
    {(analytics) => <AnalyticsChart data={analytics} />}
  </Await>
</Suspense>;
```

### Caching Loader Data

After the first page load, the browser gets loader and action data from data
requests. Loader data is often specific to the signed-in user, so Juniper marks
data responses as private by default:

| Response                        | Default `Cache-Control`           |
| ------------------------------- | --------------------------------- |
| Settled data and data errors    | `private, no-cache`               |
| Redirects sent to data requests | `private, no-cache`               |
| Deferred data stream            | `private, no-cache, no-transform` |

- `private` tells shared caches, such as a CDN or a proxy, not to store the
  response, so they do not serve one user's data to another.
- `no-cache` lets the browser keep a copy, but it must check with the server
  before each reuse.
- `no-transform` stops intermediaries from compressing or rewriting a deferred
  stream, which could hold back values that are already ready.

A data request receives a redirect as a `200` response that carries the redirect
location, so the client can navigate to it. Caches may store a `200` even when
it has no policy, and a redirect often depends on the user, such as a sign-in
redirect that carries a return path. That is why redirects get the same default
as data. This applies to redirects from loaders and actions and to redirects
from Hono middleware.

Data responses vary on `Accept` and `X-Juniper-Route-Id`, not on cookies. Only
make data public when it is the same for every visitor.

To use a different policy, set `Cache-Control` in route middleware before
calling `next()`. Your policy replaces the default. On a deferred stream,
Juniper adds `no-transform` to your policy when it is missing:

```typescript
// routes/blog/main.ts
import { Hono } from "hono";

const app = new Hono();

// Blog data is the same for every visitor. Documents also carry the layout's
// data, so only data requests get the public policy.
app.use(async (c, next) => {
  if (c.req.header("X-Juniper-Route-Id")) {
    c.header("Cache-Control", "public, max-age=60");
  }
  await next();
});

export default app;
```

Route middleware also runs for document requests. Juniper doesn't rewrite a
policy that middleware sets, although a policy from a loader, an action or an
error still replaces it. A document carries more than this route's data (see
[Caching Documents](#caching-documents)), so check for the `X-Juniper-Route-Id`
request header, which only data requests carry, when the policy is only for
data.

A few other cases:

- A policy that middleware sets after `next()` replaces the header exactly as
  written, so add `no-transform` yourself if the response might be a deferred
  stream.
- A `Cache-Control` header on a thrown `HttpError` is used for that error
  response, instead of the middleware policy or the default. On a document, it
  is made private first, as described below.
- A `Cache-Control` header on a redirect is used for that redirect, instead of
  the middleware policy or the default. This holds whether a loader or action
  throws the redirect or returns it.
- A `Response` other than a redirect that a loader or action returns keeps its
  own headers on a data request. Juniper adds no default policy to it. On a
  document, its cache headers are made private first.
- `data()` from React Router that a loader or action returns arrives on a data
  request as data with a `200` status, because the client reads any other status
  as an error. Its headers are kept, and a `Cache-Control` header among them is
  used instead of the middleware policy or the default. Its status applies to
  document requests. On a document, its cache headers are made private first.

#### Caching Documents

A document is the HTML page Juniper renders for a full page load, including an
error page. It carries the data of every loader that ran for the page, such as a
layout loader that returns the signed-in user. It also carries the request's
[shared context](state-management.md#sharing-server-context-with-the-client),
which middleware often fills per user. The pages it renders can show any of
these.

A loader's own policy describes only its own data. So when a document's cache
headers come from a loader or an action, Juniper doesn't let a shared cache
store the document. This covers `data()` or a `Response` that a loader or action
returns, and an `HttpError` that a loader, action or middleware throws. Juniper
rewrites `Cache-Control`:

- It removes `public`, `s-maxage`, and a `private` that names header fields.
- It adds `private` at the front, unless `private` or `no-store` remains.
- It keeps every other directive, such as `max-age`, `no-cache`, and `no-store`.

| The route's `Cache-Control`        | The document's `Cache-Control` |
| ---------------------------------- | ------------------------------ |
| `public, max-age=60`               | `private, max-age=60`          |
| `public, s-maxage=300, max-age=60` | `private, max-age=60`          |
| `max-age=60`                       | `private, max-age=60`          |
| `no-cache`                         | `private, no-cache`            |
| `public, no-store`                 | `no-store`                     |
| `private, max-age=60`              | `private, max-age=60`          |

Juniper also changes two other kinds of cache header from the route:

- Fields that only CDNs read become `no-store`. These are `Surrogate-Control`,
  `CDN-Cache-Control`, and names that end in `-CDN-Cache-Control`, such as
  `Cloudflare-CDN-Cache-Control`.
- `Expires` is dropped when the route sends no `Cache-Control`, because it would
  let a shared cache store the page on its own. Use `max-age` in `Cache-Control`
  instead.

This happens even when no loader ran, for example on the error page for an error
that middleware throws. That page still carries the request's context and
whatever the layouts render from it.

It doesn't happen in these cases:

- A data response keeps the route's policy as written, because it carries only
  that route's data or error.
- Juniper doesn't rewrite a header that route middleware sets. Middleware sets
  it for every response of the route, documents included.
- A document that gets no policy from the route or from middleware is sent
  without one.

When a page is the same for every visitor, set `publicDocument` in the route's
middleware. Juniper then sends the route's policy on the document as written:

```typescript
// routes/blog/[id]/index.ts
import { Hono } from "hono";
import { data } from "react-router";
import type { RouteLoaderArgs } from "@udibo/juniper";
import type { AppEnv } from "@udibo/juniper/server";
import { postService } from "@/services/post.ts";

const app = new Hono<AppEnv>();

// Every loader on this page, layouts included, returns the same data to every
// visitor.
app.use(async (c, next) => {
  c.set("publicDocument", true);
  await next();
});

export default app;

export async function loader({ params }: RouteLoaderArgs<{ id: string }>) {
  const post = await postService.get(params.id);
  return data({ post }, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
```

Only set `publicDocument` for a page whose loaders, including every layout
loader above it, and whose shared context give every visitor the same values. It
applies to every document the middleware runs for, including error pages.

### Client Loaders

Export a loader from `.tsx` when it needs to participate in client navigation.
It is also a server-executable function: without a matching `.ts` loader, it
runs during SSR. Use `isBrowser()` before reading browser-only APIs, or provide
a server loader that returns the data needed for SSR. The `.tsx` filename does
not make arbitrary imports safe for the browser.

**Note:** If a client loader only calls `serverLoader()` and returns the result,
it's unnecessary. The client automatically fetches from the server loader when
no client loader exists. Use client loaders when you need to combine server data
with client-side data or add client-side caching.

```tsx
// routes/dashboard/index.tsx
import type { AnyParams, RouteLoaderArgs, RouteProps } from "@udibo/juniper";

interface DashboardLoaderData {
  user: User;
  theme: "light" | "dark";
}

export async function loader({
  serverLoader,
}: RouteLoaderArgs<AnyParams, DashboardLoaderData>): Promise<
  DashboardLoaderData
> {
  // Get server data
  const data = await serverLoader();

  // Enhance with client-side preference
  const theme = (localStorage.getItem("theme") as "light" | "dark") ??
    data.theme;

  return { ...data, theme };
}

export default function Dashboard(
  { loaderData }: RouteProps<AnyParams, DashboardLoaderData>,
) {
  return <div className={loaderData.theme}>Welcome, {loaderData.user.name}
  </div>;
}
```

Share loader data types with type-only imports or a shared type module. These
imports are erased from the browser bundle; runtime imports of server services
are not. Both loaders must return data their component can render, including the
initial server-rendered shape.

### When Client Loaders Run

The behavior depends on which loaders are defined for a route:

| Server Loader | Client Loader | SSR Behavior       | Client Navigation             |
| ------------- | ------------- | ------------------ | ----------------------------- |
| Yes           | No            | Server loader runs | Client requests server loader |
| No            | Yes           | Client loader runs | Client loader runs            |
| Yes           | Yes           | Server loader runs | Client loader runs            |
| No            | No            | No data loading    | No data loading               |

**Key points:**

- If a route has only a server loader, the client will make a request to the
  server to fetch the loader data during client-side navigation.
- If a route has only a client loader, it runs during both SSR and client-side
  navigation.
- If a route has both loaders, the server loader runs during SSR, and the client
  loader runs during client-side navigation.

### Skipping Revalidation

By default React Router reruns the loader of every route that stays on the page
after a successful action, when a navigation changes the route's params or the
URL's search, on a navigation to the current URL, and when
`useRevalidator().revalidate()` is called. Export `shouldRevalidate` from a
route's `.tsx` module to keep its current loader data in the cases you choose.
This one skips the reload when only the search changes, such as a filter or tab
kept in the URL, and keeps the default everywhere else:

```tsx
// routes/products/index.tsx
import type { ShouldRevalidateFunction } from "react-router";

export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}) => {
  const isGet = formMethod === undefined || formMethod.toUpperCase() === "GET";
  const searchOnly = currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search;
  if (isGet && searchOnly) return false;
  return defaultShouldRevalidate;
};
```

Return `defaultShouldRevalidate` for every case you do not mean to skip. A
condition on the pathname alone also matches form submissions to the same page
and `revalidate()` calls, which leaves the page showing data from before the
change. The `formMethod` check keeps the reload after a form submission that
runs an action, and comparing the search keeps the reload after `revalidate()`,
which does not change the URL. A GET `<Form>`, such as a filter form, arrives
with `formMethod: "GET"` and is skipped like a search-only link; only a mutation
method marks an action or its redirect, so checking `!formMethod` alone would
reload on every filter submission.

The function runs only in the browser, so it applies whichever loader the route
uses: a `false` result skips the client loader, or the request for the server
loader when the route has only a server loader. It does not run during
server-side rendering or hydration, and a route that a navigation newly matches
always loads. Juniper reads it only from the `.tsx` module; a `shouldRevalidate`
exported from the paired `.ts` server module is ignored.

### Calling Server Loaders from Client Loaders

When a route has both a server loader (in `.ts`) and a client loader (in
`.tsx`), the client loader can call the server loader using the `serverLoader`
function:

```tsx
// routes/products/[id]/index.tsx
import type { RouteLoaderArgs, RouteProps } from "@udibo/juniper";

interface ProductLoaderData {
  product: Product;
  recentlyViewed: Product[];
}

export async function loader({
  serverLoader,
}: RouteLoaderArgs<{ id: string }, ProductLoaderData>): Promise<
  ProductLoaderData
> {
  // Get server data (includes product and empty recentlyViewed)
  const data = await serverLoader();

  // Enhance with client-side data
  const recentlyViewed = getRecentlyViewedFromStorage();

  return { ...data, recentlyViewed };
}

export default function Product(
  { loaderData }: RouteProps<{ id: string }, ProductLoaderData>,
) {
  return (
    <div>
      <h1>{loaderData.product.name}</h1>
      <RecentlyViewed items={loaderData.recentlyViewed} />
    </div>
  );
}
```

### Why Use Client Loaders with Server Loaders?

There are several reasons to use a client loader that calls the server loader:

1. **Combine server and client data**: Merge server-fetched data with
   client-side data like local storage, IndexedDB, or browser APIs.

2. **Client-side caching**: Implement caching strategies to reduce server
   requests during navigation.

3. **Optimistic updates**: Return cached data immediately while fetching fresh
   data in the background.

4. **Progressive enhancement**: Add client-side enhancements without changing
   server loader logic.

```tsx
// Example: Client-side caching in routes/products/[id]/index.tsx
export async function loader({
  params,
  serverLoader,
}: RouteLoaderArgs<{ id: string }, ProductLoaderData>): Promise<
  ProductLoaderData
> {
  const cacheKey = `product-${params.id}`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    // Return cached data immediately
    return JSON.parse(cached);
  }

  // Fetch from server and cache
  const data = await serverLoader();
  sessionStorage.setItem(cacheKey, JSON.stringify(data));
  return data;
}
```

## Redirects

Loaders and actions can redirect users to different routes using the `redirect`
function from `react-router`.

### Redirecting from Loaders

Use redirects in loaders to protect routes or redirect based on data:

```typescript
// routes/dashboard/index.ts
import { redirect } from "react-router";
import type { RouteLoaderArgs } from "@udibo/juniper";
import { userContext } from "@/context/user.ts";
import type { User } from "@/context/user.ts";

export function loader({ context }: RouteLoaderArgs): { user: User } {
  const user = context.get(userContext);

  if (!user) {
    throw redirect("/login");
  }

  if (user.role !== "admin") {
    throw redirect("/");
  }

  return { user };
}
```

This assumes `context/user.ts` exports the user context and `User` shape, as in
[shared context](state-management.md#sharing-server-context-with-the-client).
Initialize it in authenticated server middleware, which must still protect the
underlying data requests and services.

### Redirecting from Actions

Actions commonly redirect after successful form submissions:

```typescript
// routes/blog/create.ts
import { redirect } from "react-router";
import type { RouteActionArgs } from "@udibo/juniper";

export async function action({ request }: RouteActionArgs) {
  const formData = await request.formData();
  const post = await createPost(formData);

  // Redirect to the new post
  throw redirect(`/blog/${post.id}`);
}
```

### Returning vs Throwing Redirects

Throw redirects so navigation exits the loader or action immediately and its
data type does not need to include `Response`. Server handlers and ordinary
React Router handlers also support returned redirects. Keep redirect decisions
in blocking loaders: adding `HydrateFallback` to an async client loader defers
its promise to rendering, including its later rejection. Do not rely on either a
returned or thrown response inside that deferred promise to navigate. Omit the
fallback on a loader that redirects and use a mounted layout's `useNavigation()`
status while it resolves.

```typescript
import { redirect } from "react-router";
import type { RouteActionArgs } from "@udibo/juniper";

export async function action(
  { request }: RouteActionArgs,
): Promise<void> {
  await saveForm(await request.formData());
  throw redirect("/success");
}
```

The example assumes an application `saveForm` service. If a surrounding `catch`
handles failures, rethrow `Response` values before converting ordinary errors,
or it will swallow the redirect.

### Client-Side Redirects

Client loaders and actions can also use redirects:

```tsx
// routes/settings/index.tsx
import { redirect } from "react-router";
import type { AnyParams, RouteLoaderArgs } from "@udibo/juniper";

interface SettingsLoaderData {
  settings: { theme: "light" | "dark" };
}

export async function loader({
  serverLoader,
}: RouteLoaderArgs<AnyParams, SettingsLoaderData>): Promise<
  SettingsLoaderData
> {
  const token = localStorage.getItem("authToken");
  if (!token) {
    throw redirect("/login");
  }

  return await serverLoader();
}
```

The example assumes a matching server loader for SSR. The browser token check
only controls navigation; validate the session on the server too. Keep this
loader blocking, without `HydrateFallback`, so its redirect stays in router
control flow.

For client actions:

```tsx
// routes/settings/index.tsx
import { redirect } from "react-router";
import type { AnyParams, RouteActionArgs } from "@udibo/juniper";

export async function action({
  serverAction,
}: RouteActionArgs<AnyParams, void>): Promise<void> {
  // Save to server
  await serverAction();

  // Redirect to confirmation page
  throw redirect("/settings/saved");
}
```

### Forcing a Page Refresh

Throw `redirectDocument(destination)` when an action must load a fresh document
at a destination. The helper is exported by both `@udibo/juniper` and
`react-router`. This example pairs an action with a form at `/account/refresh`:

```typescript
// routes/account/refresh.ts
import { redirectDocument } from "@udibo/juniper";
import type { RouteActionArgs } from "@udibo/juniper";

export function action({ request }: RouteActionArgs): never {
  throw redirectDocument(new URL("/account", request.url).href);
}
```

```tsx
// routes/account/refresh.tsx
import { Form } from "react-router";

export default function RefreshAccount(): React.JSX.Element {
  return (
    <Form method="post">
      <button type="submit">Reload account</button>
    </Form>
  );
}
```

Ensure the destination exists and can render without issuing the same document
redirect again. Explicit document redirects are application instructions, so the
application must avoid redirect loops.

Juniper already detects build-ID mismatches in server loader responses and
recovers from missing lazy bundles. A custom version-cookie middleware is not
needed for that mechanism. See
[deployment](deployment.md#deploying-new-bundles).

For compatibility, an ordinary redirect to the exact current **document URL**
also requests a refresh, limited to two attempts within 30 seconds. The equality
includes its query and fragment. It compares against the browser's current URL,
which can differ from the pending loader request's URL; redirecting to
`request.url` is not a reliable instruction to reload a new destination.

## Navigation

### Pending Navigation

Juniper uses `HydrateFallback` for initial client hydration and deferred loader
data within that route. It cannot provide feedback while that route's module is
still downloading. For navigation that waits for a route module or a blocking
server loader, render feedback in an already loaded layout with React Router's
`useNavigation`:

```tsx
import { Outlet, useNavigation } from "react-router";

export default function Main() {
  const navigation = useNavigation();
  return (
    <>
      <p role="status">
        {navigation.state === "loading" ? "Loading page…" : ""}
      </p>
      <Outlet />
    </>
  );
}
```

The current page remains visible until the destination's module and blocking
loaders are ready. Adding `HydrateFallback` to a layout also defers that
layout's async client loader during later navigation. Its fallback can replace
the layout's content while that data is pending; do not add a root fallback just
to indicate navigation progress.

If a deployment removed a lazy route bundle, Juniper recovers with a document
navigation to the destination, including its query and fragment. The route stays
pending during that recovery so an error boundary does not flash before the new
SSR page arrives. If the reload guard is exhausted, the error reaches the
boundary. If a document navigation is canceled, navigating away and back can
retry recovery within that same limit.

### Before Hydration

The root `routes/main.tsx` may export `beforeHydrate(document)`. Juniper calls
it immediately before React hydrates the document. Use it to capture native form
state that React or an enhanced control would otherwise replace, then hand that
state to the control as it mounts. Keep the SSR structure consistent with
React's initial render.

The hook may return a cleanup function. Release observers and listeners as soon
as their work is complete; Juniper also calls cleanup on an unrecoverable
hydration failure or when the document is discarded. A page entering the
back-forward cache retains its hook resources. This hook belongs to the root
client module, not a lazy child route. See the
[RootRouteModule API](https://jsr.io/@udibo/juniper/doc/~/RootRouteModule).

### Link Component

Use the `Link` component for client-side navigation:

```tsx
import { Link } from "react-router";

function Navigation() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/blog">Blog</Link>
      <Link to={`/blog/${post.id}`}>View Post</Link>

      {/* With search params */}
      <Link to="/search?q=juniper">Search</Link>

      {/* Replace history entry */}
      <Link to="/login" replace>Login</Link>
    </nav>
  );
}
```

For active link styling, use `NavLink`:

```tsx
import { NavLink } from "react-router";

function Navigation() {
  return (
    <nav>
      <NavLink
        to="/blog"
        className={({ isActive }) =>
          isActive ? "text-emerald-400" : "text-slate-300"}
      >
        Blog
      </NavLink>
    </nav>
  );
}
```

### Programmatic Navigation

Use the `useNavigate` hook for programmatic navigation:

```tsx
import { useNavigate } from "react-router";

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return <button onClick={handleLogout}>Logout</button>;
}
```

Navigate with options:

```tsx
// Replace current history entry
navigate("/dashboard", { replace: true });

// Pass state to the next route
navigate("/checkout", { state: { from: "cart" } });

// Go back/forward
navigate(-1); // Go back
navigate(1); // Go forward
```

## URL Parameters and Search Params

### Route Parameters

Access route parameters via `params`:

```tsx
import type { RouteProps } from "@udibo/juniper";

// For route /blog/:id
export default function BlogPost({ params }: RouteProps<{ id: string }>) {
  const postId = params.id;
  return <div>Post ID: {postId}</div>;
}
```

### Search Parameters

Access search parameters from the request URL:

```typescript
// routes/search/index.ts
export async function loader({ request }: RouteLoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const results = await search(query, page);
  return { results, query, page };
}
```

Use the `useSearchParams` hook in components:

```tsx
import { useSearchParams } from "react-router";

function SearchFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "all";

  const handleCategoryChange = (newCategory: string) => {
    setSearchParams((prev) => {
      prev.set("category", newCategory);
      return prev;
    });
  };

  return (
    <select
      value={category}
      onChange={(e) => handleCategoryChange(e.target.value)}
    >
      <option value="all">All</option>
      <option value="tech">Technology</option>
      <option value="news">News</option>
    </select>
  );
}
```

## Next Steps

**Next:** [Middleware](middleware.md) - Server and client middleware

**Related topics:**

- [Forms](forms.md) - Form handling with client and server actions
- [Error Handling](error-handling.md) - Error boundaries and HttpError
- [State Management](state-management.md) - Sharing data across your app
