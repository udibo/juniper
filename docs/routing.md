# Routing

Juniper treats your `routes/` directory as the source of truth for both the
server-side Hono tree and the client-side React Router tree. The builder scans
every directory, classifies files by name (`main.ts`, `index.ts`, dynamic
folders, etc.), and generates a pair of entrypoints that keep the two halves in
sync.

## How the generator works

1. The build step walks the `routes/` tree and emits a nested object describing
   the server routes. Each node references `main.ts`, `index.ts`, or
   parameterized files within that folder. The generated `main.ts` calls
   `createServer(import.meta.url, client, routes)` from `@udibo/juniper/server`.
2. The same scan runs for `.tsx` files to produce the client route hierarchy
   consumed by `new Client(...)`.
3. `@udibo/juniper/server` stitches the two trees together. Server middleware
   runs first; when a request expects HTML it falls through to the React
   handlers, otherwise it is handled purely by Hono.

Because both entrypoints are generated at build time, you only edit files inside
`routes/`.

## File roles

In the following example, the layout separates API endpoints (`routes/api/blog`)
from user-facing pages (`routes/blog`). Use whatever structure fits your
project; the generator only cares about file names, not directory intent.

```
routes/
├── main.ts           # Global server middleware + serializeError
├── main.tsx          # Root React layout + ErrorBoundary/deserializeError
├── index.tsx         # Optional root index route
├── api/
│   └── blog/
│       ├── main.ts   # Shared middleware for blog APIs
│       ├── index.ts  # JSON list of blog posts
│       └── [slug].ts # JSON for a single post
└── blog/
    ├── main.ts       # Blog-specific server middleware (auth, headers, etc.)
    ├── main.tsx      # Blog layout with <Outlet/>
    ├── index.tsx     # Blog landing page
    └── [slug].tsx    # Dynamic document route
```

- `main.ts` (server) files can appear in any route directory and are ideal for
  cross-cutting concerns such as logging, auth, or headers that should apply to
  that segment and its children. When a path has both server (`.ts`) and client
  (`.tsx`) files, the server middleware runs first. If none of the handlers send
  a response, the framework appends a final handler that renders the React
  application for that route. Only the root `routes/main.ts` can export
  `serializeError` because it governs the entire app's error serialization.
- `main.tsx` (client) files can also exist at any depth to define layouts with
  `<Outlet />`. Only the root `routes/main.tsx` can export `deserializeError`,
  since it pairs with the root serializer.
- `index.ts`/`index.tsx` handle the exact path of the containing directory.
- Plain `.ts` files become server routes; plain `.tsx` files become client
  routes.
- `[param].ts` or `[param].tsx` introduce dynamic segments (`/blog/:slug`).
- `[...].ts` or `[...].tsx` become catch-all handlers (`/docs/*`).
- Files and directories prefixed with `_` are ignored.

## Server routing (Hono)

Each server file exports a Hono instance. Middleware and handlers cascade from
parent directories to children:

```ts
// routes/api/main.ts
import { Hono } from "hono";
import { HttpError } from "@udibo/juniper";
import { getInstance } from "@udibo/juniper/utils/otel";

const app = new Hono();
app.onError((cause) => {
  const error = HttpError.from(cause);
  error.instance ??= getInstance();
  console.error(error);
  return error.getResponse();
});

export default app;
```

```ts
// routes/api/blog/index.ts
import { Hono } from "hono";
import { postService } from "/services/post.ts";

const app = new Hono();

app.get("/", async (c) => {
  const { entries } = await postService.list();
  return c.json({ posts: entries });
});

export default app;
```

```ts
// routes/api/blog/[slug].ts
import { Hono } from "hono";
import { postService } from "/services/post.ts";
import { HttpError } from "@udibo/juniper";

const app = new Hono();

app.get("/", async (c) => {
  const post = await postService.getBy("slug", c.req.param("slug"));
  if (!post) throw new HttpError(404, "Post not found");
  return c.json(post);
});

export default app;
```

Any HTTP verb supported by Hono can be used (`get`, `post`, `route`, etc.). When
a server route emits JSON or any non-HTML response it short-circuits the React
rendering pipeline.

## Client routing (React Router)

Client files export React route modules (`Component`, `loader`, `action`,
`ErrorBoundary`, etc.). The generated `main.tsx` contains the client routing
tree and hydrates the React Router client in the browser after `/build/main.js`
loads.

```tsx
// routes/blog/[slug].tsx
import { HttpError } from "@udibo/juniper";
import type { RouteLoaderArgs, RouteProps } from "@udibo/juniper";
import type { Post } from "/services/post.ts";
import { postService } from "/services/post.ts";

interface BlogParams {
  slug: string;
}

interface BlogPostLoaderData {
  post: Post;
}

export async function loader(
  { params }: RouteLoaderArgs<BlogParams>,
): Promise<BlogPostLoaderData> {
  const post = await postService.getBy("slug", params.slug);
  if (!post) throw new HttpError(404, "Post not found");
  return { post };
}

export default function BlogPost(
  { loaderData }: RouteProps<BlogParams, BlogPostLoaderData>,
) {
  return (
    <article>
      <title>{loaderData.post.title}</title>
      {/* content */}
    </article>
  );
}
```

React Router features such as `defer`, `Await`, and nested layouts with `Outlet`
work as expected. React 19 handles streaming updates to head elements like
`<title>` and `<meta>`.

## Next steps

- Read [HTTP Middleware](http-middleware.md) for a deep dive into middleware
  layering.
- Pair this guide with [Forms](forms.md) and
  [State Management](state-management.md) to get the most from React Router
  loaders and actions.
