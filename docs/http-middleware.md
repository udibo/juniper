# HTTP Middleware

Juniper inherits Hono's middleware model. Every route file exports a Hono
application, and the builder automatically composes them into a single tree.
This guide explains where middleware runs, how errors propagate, and how to
layer observability across the stack.

## Layering model

Middleware executes in the following order for document requests:

1. **Framework wrapper** – `createServer` configures global behavior
   (`HttpError` normalization, `trimTrailingSlash`, static file serving,
   tracing).
2. **Root `routes/main.ts`** – your first chance to add app-wide middleware
   (logging, feature flags, serialization helpers).
3. **Nested `main.ts` files** – server middleware scoped to a specific branch
   (e.g., `routes/api/main.ts`, `routes/blog/main.ts`).
4. **Nested `main.tsx` files** – client/layout middleware scoped to a specific
   branch (e.g., `routes/blog/main.tsx`).
5. **Leaf handlers** – individual `.ts` or `.tsx` files handle the request (REST
   endpoints, loaders/actions, React components).

Because each node returns a full Hono app, you can use any existing Hono
middleware or author your own via `createMiddleware`.

Whenever a path includes both server (`.ts`) and client (`.tsx`) files, the
server middleware runs first. If none of the server handlers write a response,
Juniper appends a final handler that renders the React application for that
route. Only the root `routes/main.ts` can export `serializeError`, and only the
root `routes/main.tsx` can export `deserializeError`, since those govern the
global error-serialization pair.

## Framework-provided middleware

`server.tsx` ships with two important defaults:

```ts
// server.tsx
import { HttpError } from "@udibo/http-error";
import { trimTrailingSlash } from "hono/trailing-slash";
import { getInstance } from "@udibo/juniper/utils/otel";

const appWrapper = new Hono({ strict: true });
appWrapper.onError((cause) => {
  const error = HttpError.from(cause);
  error.instance ??= getInstance();
  console.error(error);
  return error.getResponse();
});
appWrapper.use(trimTrailingSlash());
```

- All thrown values become `HttpError` instances so your API responses stay
  consistent.
- `getInstance()` stamps the trace/span ID onto the error so logs can be
  correlated with OpenTelemetry.
- Trailing slashes are stripped before routing so `/blog/` and `/blog` behave
  the same.

You do not need to add these manually; every generated server already includes
them.

## Root middleware (`routes/main.ts`)

Use the root `main.ts` to install middleware that should run for every request.
For instance, you can add request logging and feature-flag headers:

```ts
// routes/main.ts
import { Hono } from "hono";
import { logger } from "hono/logger";
import { isDevelopment } from "@udibo/juniper/utils/env";

const app = new Hono();
app.use(logger());

if (isDevelopment()) {
  app.use(async (c, next) => {
    c.header("x-dev-mode", "true");
    await next();
  });
}

export default app;
```

Because this file executes before any nested route, it is the ideal place to set
response headers, enforce CSP defaults, or expose helper objects on the context
(`c.set("user", user)`).

## Area-specific middleware

Scope middleware at different depths by using `main.ts` files inside
directories. For instance, `routes/api/main.ts` centralizes API error handling
and instrumentation:

```ts
import { Hono } from "hono";
import { HttpError } from "@udibo/http-error";
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

This keeps API behavior isolated from the document pipeline, while still
inheriting the root logger and framework defaults.

## Route-level middleware

Inside a leaf file you can still register middleware before defining handlers:

```ts
// routes/api/users.ts
import { Hono } from "hono";
import { userService } from "/services/user.ts";

const app = new Hono();
app.use("*", async (c, next) => {
  c.header("x-service", "users");
  await next();
});

app.get("/", async (c) => {
  const options = userService.parseListQueryParams(c.req.query());
  const { entries, cursor } = await userService.list(options);
  return c.json({ users: entries, cursor });
});

export default app;
```

Hono mounts middleware in the order you call `app.use`, so add request IDs,
caching headers, or body parsers before registering handlers.

## Conditional middleware

Use `@udibo/juniper/utils/env` to toggle middleware per environment:

```ts
import { isDevelopment, isProduction } from "@udibo/juniper/utils/env";
import { logger } from "hono/logger";
import { compress } from "hono/compress";

const app = new Hono();
if (isDevelopment()) app.use(logger());
if (isProduction()) app.use(compress());
```

This keeps local builds verbose while production traffic benefits from
compression.

## Custom middleware helpers

Author reusable helpers with `createMiddleware`:

```ts
import { createMiddleware } from "hono/factory";
import { HttpError } from "@udibo/http-error";

export const requireApiKey = createMiddleware(async (c, next) => {
  const apiKey = c.req.header("x-api-key");
  if (apiKey !== Deno.env.get("API_KEY")) {
    throw new HttpError(401, "Invalid API key");
  }
  await next();
});
```

Then use it in any route file:

```ts
const app = new Hono();
app.use("/internal/*", requireApiKey);
```

## Error propagation and telemetry

- Throw `HttpError` (or subclasses) to control status codes and response bodies.
- Any other error is converted via `HttpError.from(cause)` and logged with trace
  metadata.
- Add `app.onError` blocks at any level to attach context-specific logs or
  metrics.
- Use `otelUtils(trace.getTracer("service"))` when a middleware performs async
  work that should appear in traces (e.g., database pooling or RPC calls).

## Ordering tips

1. **Log early.** Place logging/request ID middleware before authentication so
   failed auth attempts are captured.
2. **Authenticate before rate limiting sensitive routes.** Rate limiters often
   rely on user identity; ensure `authMiddleware` runs before `rateLimiter`.
3. **Mutate responses last.** Compression, caching headers, and security
   policies should run after handlers set their specific headers.
4. **Reuse context.** Store expensive resources (database handles, feature flag
   snapshots) on the Hono context so downstream handlers do not reopen them.

## Checklist

- Install app-wide middleware in `routes/main.ts`.
- Create dedicated `main.ts` files for each major area (API, admin, etc.).
- Keep leaf middleware focused and ordered (log → auth → business logic).
- Always convert thrown values to `HttpError` or let the framework do it for
  you.
- Capture trace IDs with `getInstance()` whenever you log or rethrow.
