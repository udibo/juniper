# Error Handling

Juniper centralizes error handling so API routes, loaders, and React components
all produce consistent responses. Understanding the stack makes it easier to
surface helpful messages while preserving tracing data.

## Global handler

`createServer` installs an `onError` hook that wraps every thrown value:

```ts
appWrapper.onError((cause) => {
  const error = HttpError.from(cause);
  if (!error.instance) {
    const instance = getInstance();
    if (instance) error.instance = instance;
  }
  console.error(error);
  return error.getResponse();
});
```

- `HttpError.from` converts unknown values into HTTP-friendly errors (default
  500).
- `error.instance` stores `/trace/{traceId}/span/{spanId}` so you can click
  directly into Grafana.
- The resulting `Response` contains the correct status, message, and headers.

## Route-level patterns

Throw `HttpError` for predictable outcomes:

```ts
import { HttpError } from "@udibo/juniper";

app.get("/:id", async (c) => {
  const user = await userService.get(c.req.param("id"));
  if (!user) throw new HttpError(404, "User not found");
  return c.json(user);
});
```

Inside React Router loaders or actions, you can either throw `HttpError` or
return `json` with an error payload. Thrown errors bubble into the same global
handler for server requests and into React Router’s `ErrorBoundary` on the
client.

## Custom error serialization

When you throw custom errors, serialize them in `routes/main.ts` and deserialize
in `routes/main.tsx`. For instance:

```ts
// utils/error.ts
export class CustomError extends Error {
  constructor(
    message: string,
    public readonly exposeStack: boolean = false,
  ) {
    super(message);
  }
}
```

```ts
// routes/main.ts
export function serializeError(error: unknown) {
  if (error instanceof CustomError) {
    return {
      __type: "Error",
      __subType: "CustomError",
      message: error.message,
      exposeStack: error.exposeStack,
      stack: error.stack,
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

This keeps server-rendered errors and client ErrorBoundaries synchronized, even
when custom properties are involved.

## Client fallbacks

- Implement `ErrorBoundary` exports on layout and leaf routes to display
  contextual messages.
- Provide `HydrateFallback` components for routes that stream. They render on
  the client while waiting for hydration errors to resolve.
- For Suspense boundaries using `Await`, include `errorElement` props or
  `useAsyncError()` to render user-friendly states when deferred data rejects.

## Observability

- Wrap expensive operations in `startActiveSpan` (`utils/otel.ts`). If a span
  throws, the helper records the exception and attaches the trace ID to the
  `HttpError`.
- Log meaningful fields (user IDs, route params) but avoid PII. Since errors
  already include the trace ID, you can look up full context in your telemetry
  stack instead of logging sensitive data.
- For client-side errors during hydration, `client.hydrate()` logs both
  `onUncaughtError` and `onCaughtError`. Add your own reporter there if you want
  to forward issues to a logging service.

## Checklist

- Throw `HttpError` whenever you know the status code; let the global handler do
  the rest.
- Export `serializeError`/`deserializeError` if you need custom error classes.
- Add ErrorBoundaries at each layout level to keep UI states localized.
- Use OTEL helpers to correlate logs with traces automatically.
- Keep error messages consistent and actionable for both REST clients and
  browser users.
