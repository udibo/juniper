# Logging

Consistent logging makes it easier to debug streaming renders, API routes, and
build steps. Juniper integrates with OpenTelemetry so every log line can
reference the current trace/span. This guide covers the built-in behavior and
recommended practices.

## Server logging defaults

- `routes/main.ts` installs `logger()` from `hono/logger`, which prints concise
  request/response logs during development.
- `createServer` logs every uncaught error via `console.error(error)` after
  converting it to `HttpError`.

To add structured logging, replace the default logger with your own middleware:

```ts
app.use(async (c, next) => {
  const start = performance.now();
  await next();
  console.log(JSON.stringify({
    path: c.req.path,
    method: c.req.method,
    status: c.res.status,
    durationMs: performance.now() - start,
  }));
});
```

## Trace correlation

`utils/otel.ts` exposes two helpers:

- `getInstance()` – returns `/trace/{traceId}/span/{spanId}` for the active
  span. Attach this string to logs or HttpErrors.
- `otelUtils(trace.getTracer("service")).startActiveSpan(...)` – wraps work in a
  span and records errors automatically.

Whenever you log a serious error manually, tag it with the current instance:

```ts
const instance = getInstance();
console.error("Failed to save post", { postId, instance });
```

## Structured vs. console logs

- Prefer JSON logs in production so downstream aggregators (Grafana, CloudWatch)
  can index fields.
- Redact secrets before logging (API keys, tokens). Add a sanitizer middleware
  if necessary.
- Keep noisy debug logs behind `isDevelopment()` checks to avoid exploding log
  volumes in prod.

## Client-side logging

The hydration script registers callbacks:

```ts
hydrateRoot(document, <App />, {
  onUncaughtError: (error) => console.error("hydrate onUncaughtError", error),
  onCaughtError: (error) => console.error("hydrate onCaughtError", error),
});
```

Hook into these events by wrapping `console.error` or by providing your own
reporter (e.g., Sentry) before the client bundle executes. You can also add
error boundaries that call `console.error` or send telemetry when rendering
fallback UI.

## Shipping logs

- **Local development** – console output is usually enough. Consider piping
  through `deno task dev | jq` when using JSON logs.
- **Production** – forward stdout/stderr to your log aggregation stack. Include
  trace IDs so linking to Grafana Tempo or Jaeger is trivial.
- **Sampling** – for high-traffic APIs, log every request at INFO during
  development but sample to, say, 10% in production (or log only errors plus
  aggregated metrics).

## Next steps

- Review [Error Handling](error-handling.md) to see how errors become log
  entries.
- Check [CI/CD](ci-cd.md) for tips on exporting logs from GitHub Actions or
  container builds.
