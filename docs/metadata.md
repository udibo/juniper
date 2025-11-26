# Metadata

Juniper renders documents with React Router streaming, so every `<title>`,
`<meta>`, and `<link>` element you declare is part of the server response. This
guide explains how to manage global metadata, update it per route, and keep
error states in sync between server and client.

## Root document shell

The root React module (`routes/main.tsx`) is the canonical place to define head
elements that every page should include:

```tsx
// routes/main.tsx
export default function Main() {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <link rel="icon" href="/favicon.ico" />
      <Outlet />
    </>
  );
}
```

- These elements are emitted before any nested routes render, so crawlers and
  browsers see them immediately.
- Because React 19 supports rendering `<title>`/`<meta>` anywhere in the tree,
  you can also set defaults here and override them in child routes.

## Per-route metadata

Set metadata inside individual route components to reflect loader data:

```tsx
// routes/blog/[id].tsx
export default function BlogPost(
  { loaderData }: RouteProps<{ id: string }, { post: Post }>,
) {
  return (
    <article>
      <title>{loaderData.post.title} · Juniper Blog</title>
      <meta name="description" content={loaderData.post.summary} />
      {/* ... */}
    </article>
  );
}
```

Because the component renders on the server first, the `<title>` tag is included
in the streamed HTML. When the client hydrates, React reconciles the same
structure, avoiding double titles.

## Async metadata

When metadata depends on asynchronous loaders (e.g., `defer`), wrap the content
in `Suspense` and update the `<title>` after the promise resolves:

```tsx
import { Await, useLoaderData } from "react-router";

export default function DeferredPage() {
  const { delayedMessage } = useLoaderData() as DeferLoaderData;
  return (
    <Suspense fallback={<title>Loading…</title>}>
      <Await resolve={delayedMessage}>
        {(message: string) => (
          <>
            <title>{`Defer ${message}`}</title>
            {/* rest of layout */}
          </>
        )}
      </Await>
    </Suspense>
  );
}
```

The first chunk still includes the fallback title, but once the promise resolves
the stream sends the updated title and the browser swaps it in.

## Error metadata

Use React Router `ErrorBoundary` exports to control metadata when an error is
thrown:

```tsx
export function ErrorBoundary({ params, error }: ErrorBoundaryProps) {
  return (
    <>
      <title>Blog post not found</title>
      <meta name="robots" content="noindex" />
      <div>Could not load post {params.id}</div>
    </>
  );
}
```

Custom error classes can be serialized on the server and deserialized on the
client:

```ts
// routes/main.ts
import { CustomError } from "/utils/error.ts";

export function serializeError(error: unknown) {
  if (error instanceof CustomError) {
    return {
      __type: "Error",
      __subType: "CustomError",
      message: error.message,
      exposeStack: error.exposeStack,
    };
  }
}
// routes/main.tsx
export function deserializeError(serialized: unknown) {
  if (isSerializedCustomError(serialized)) {
    const restored = new CustomError(
      serialized.message,
      serialized.exposeStack,
    );
    restored.stack = serialized.stack;
    return restored;
  }
}
```

This ensures metadata shown in `ErrorBoundary` components matches the
server-rendered version even after hydration.

## Deterministic output

- Keep metadata deterministic for crawlers: avoid random numbers or
  request-specific IDs in `<title>`/`<meta>` elements unless they reflect actual
  content.
- When toggling metadata based on environment (e.g., preview banners), gate it
  with `isDevelopment()` so production crawlers are unaffected.
- If multiple routes render the same head element, React deduplicates them.
  Prefer one `<title>` per document but feel free to emit multiple `<meta>` tags
  (`description`, `og:*`, etc.).

## Next steps

- Review [Styling](styling.md) to see how to link CSS outputs alongside
  metadata.
- Visit [Error Handling](error-handling.md) for a deeper explanation of
  serialization hooks and trace logging.
