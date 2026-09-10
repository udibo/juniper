---
title: Routing
last_verified: 2026-09-09
---

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

| Export            | Type      | Description                                       |
| ----------------- | --------- | ------------------------------------------------- |
| `default`         | Component | The React component to render                     |
| `loader`          | Function  | Fetches data before rendering                     |
| `action`          | Function  | Handles form submissions                          |
| `middleware`      | Array     | Functions that run before loaders/actions         |
| `ErrorBoundary`   | Component | Displays errors for this route                    |
| `HydrateFallback` | Component | Shows while deferred route data is unresolved     |
| `beforeHydrate`   | Function  | Runs before React hydrates (root `main.tsx` only) |

Export `publicEnvKeys` from the root **server** module, `routes/main.ts`, to
allowlist additional environment values in hydration data. See
[configuration](configuration.md#public-environment-variables).

Juniper serializes JSON-shaped data, `undefined`, `Date`, and `Error`. It also
accepts `bigint` and promise values, with numeric and deferred-data behavior
described in [serializable values](state-management.md#serializable-values).
Register other classes with `registerType`; unregistered objects do not retain
their class identity.

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

## Changelog

- **2026-09-09** — Corrected default serialization claims and linked the
  supported-value and custom-registration contract.

- **2026-09-09** — Replaced the incorrect version-cookie refresh recipe with an
  explicit document redirect; clarified blocking authentication and cleaned up
  revised examples.

- **2026-09-09** — Clarified universal loader execution, deferred redirect
  limits, layout remounting, root pending feedback, and the beforeHydrate hook.
