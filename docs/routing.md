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

// Optional: Serialize context for client hydration
export function serializeContext(context: RouterContextProvider) {
  return {
    user: context.get(userContext),
  };
}

export default app;
```

### Client Routes (main.tsx)

The `.tsx` files define React components and client-side behavior:

```tsx
// routes/main.tsx
import { Outlet } from "react-router";
import type { ErrorBoundaryProps } from "@udibo/juniper";

// Root layout wraps all routes
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

// Error boundary for unhandled errors
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

| Export               | Type      | Description                                         |
| -------------------- | --------- | --------------------------------------------------- |
| `default`            | Component | The React component to render                       |
| `loader`             | Function  | Fetches data before rendering                       |
| `action`             | Function  | Handles form submissions                            |
| `middleware`         | Array     | Functions that run before loaders/actions           |
| `ErrorBoundary`      | Component | Displays errors for this route                      |
| `HydrateFallback`    | Component | Shows during client hydration                       |
| `serializeContext`   | Function  | Serializes context for client (root only)           |
| `deserializeContext` | Function  | Deserializes context on client (root only)          |
| `deserializeError`   | Function  | Custom error deserialization (root only)            |
| `publicEnvKeys`      | Array     | Environment variables exposed to client (root only) |

Juniper's serialization (used for context, loader data, action data, and errors)
supports all standard JSON types plus: `undefined`, `bigint`, `Date`, `RegExp`,
`Set`, `Map`, `Error`, and `URL`. Loaders and actions can also return `Promise`
values. See
[State Management](state-management.md#sharing-server-context-with-the-client)
for details.

## Data Loading

### Server Loaders

Loaders fetch data before rendering a route. They always run on the server.
Loader data is automatically serialized when sent to the client, supporting all
standard JSON types plus: `undefined`, `bigint`, `Date`, `RegExp`, `Set`, `Map`,
`Error`, `URL`, and `Promise`.

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

Client loaders run in the browser and are defined by exporting a `loader`
function from your `.tsx` route files (the file extension determines whether
it's a server or client loader).

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
}: RouteLoaderArgs<AnyParams, DashboardLoaderData>): Promise<DashboardLoaderData> {
  // Get server data
  const data = await serverLoader();

  // Enhance with client-side preference
  const theme = (localStorage.getItem("theme") as "light" | "dark") ?? data.theme;

  return { ...data, theme };
}

export default function Dashboard(
  { loaderData }: RouteProps<AnyParams, DashboardLoaderData>,
) {
  return <div className={loaderData.theme}>Welcome, {loaderData.user.name}</div>;
}
```

**Important:** Define your loader data types in the client route file (`.tsx`)
rather than importing them from the server route file (`.ts`). This maintains
proper separation between server and client code and prevents server-only code
from being bundled into the client.

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
}: RouteLoaderArgs<{ id: string }, ProductLoaderData>): Promise<ProductLoaderData> {
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

export async function loader({ context }: RouteLoaderArgs) {
  const user = context.get(userContext);

  // Redirect unauthenticated users
  if (!user) {
    throw redirect("/login");
  }

  // Redirect based on user role
  if (!user.isAdmin) {
    throw redirect("/");
  }

  return { user };
}
```

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

You can either return or throw a redirect. Throwing is recommended because it
allows you to exclude `Response` from the return type:

```typescript
// Return a redirect (return type must include Response)
export async function action(
  { request }: RouteActionArgs,
): Promise<ActionData | Response> {
  // ... process form
  return redirect("/success");
}

// Throw a redirect (return type excludes Response) - Recommended
export async function action(
  { request }: RouteActionArgs,
): Promise<ActionData> {
  // ... process form
  throw redirect("/success");
}
```

Throwing a redirect also ensures code after the redirect doesn't execute,
similar to throwing an error.

### Client-Side Redirects

Client loaders and actions can also use redirects:

```tsx
// routes/settings/index.tsx
import { redirect } from "react-router";
import type { AnyParams, RouteLoaderArgs } from "@udibo/juniper";

interface SettingsLoaderData {
  settings: UserSettings;
}

export async function loader({
  serverLoader,
}: RouteLoaderArgs<AnyParams, SettingsLoaderData>): Promise<SettingsLoaderData> {
  // Check client-side authentication
  const token = localStorage.getItem("authToken");
  if (!token) {
    throw redirect("/login");
  }

  return serverLoader();
}
```

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

## Navigation

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
