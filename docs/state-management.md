# State Management

Juniper leans on React Router for data flow: loaders fetch data on the server,
their results are serialized into the hydration payload, and the client reuses
them until a revalidation occurs. This guide shows how to structure
loader-driven state, layer additional providers, and integrate third-party
stores.

## Loader-driven data

Every route can export a `loader`. When the server receives a document request,
`_server.tsx` runs `createStaticHandler` and collects loader results before
rendering. The results are serialized via `serializeHydrationData` and embedded
inside `<HydrationScript>`. On the client, `Client.loadLazyMatches()` eagerly
loads the lazy routes for the current matches so that `loaderData` is already
populated when hydration begins.

```tsx
export function loader(): DeferLoaderData {
  return {
    message: "Hello",
    delayedMessage: delay(1000).then(() => "World"),
    oops: delay(2000).then(() => {
      throw new Error("Oops");
    }),
  };
}

export default function Defer({
  loaderData,
}: RouteProps<AnyParams, DeferLoaderData>) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Await resolve={loaderData.delayedMessage}>
        {(value) => <p>Delayed message: {value}</p>}
      </Await>
    </Suspense>
  );
}
```

Because loaders run on both server and client during revalidation, keep them
idempotent and ensure they throw `HttpError` for bad states.

## Context providers

Wrap application-wide providers inside `routes/main.tsx` so they are part of
both the server render and the client tree:

```tsx
import { ThemeProvider } from "./theme.tsx";

export default function Main() {
  return (
    <ThemeProvider>
      <Outlet />
    </ThemeProvider>
  );
}
```

For providers that only apply to a subsection of the tree (e.g., `/blog`),
create a layout route (`routes/blog/main.tsx`) and wrap `<Outlet />` there. This
mirrors React Router’s layout model and keeps providers scoped.

## Client-side middleware and future context

The roadmap includes first-class “client middleware” to inject data into
loaders/actions. Until then, you can pass data via React context or route props:

- Store shared data in `loaderData` on parent routes and read it via
  `useRouteLoaderData`.
- Expose typed contexts to avoid prop drilling.
- Use `useRevalidator()` and `useFetcher()` to refresh state after mutations.

## Third-party stores

Libraries such as React Query, Zustand, or Jotai work out of the box:

- Initialize the provider inside `routes/main.tsx` so it participates in SSR.
- Preload queries inside loaders and hydrate them by serializing their cache via
  loader data or custom scripts.
- For React Query, consider writing a helper loader that reuses the query key
  and returns `dehydrate(queryClient)`.

Remember that Juniper already streams HTML, so keep client-side stores
synchronized with loader states to avoid flicker.

## Testing stateful routes

Use utilities from `@udibo/juniper/utils/testing`:

- `simulateEnvironment()` wraps a callback with temporary env var overrides for
  tests manipulating feature flags.
- Snapshot serialized loader data to verify revalidation logic. Combine with
  `isSnapshotMode()` to update fixtures when needed.

## Next steps

- Explore [Forms](forms.md) for handling mutations and optimistic updates.
- Review [Logging](logging.md) to capture state transitions in middleware and
  loaders.
