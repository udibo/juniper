# Logging

## Overview

Juniper supports multiple logging approaches, from simple console logging to
comprehensive observability with OpenTelemetry. You can use Hono's built-in
logger middleware for request logging and Deno's native OpenTelemetry
integration for traces, metrics, and logs.

## Hono Logger Middleware

The simplest way to add request logging is with Hono's built-in logger
middleware:

```typescript
// routes/main.ts
import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();

// Log all requests
app.use(logger());

export default app;
```

This logs each request with method, path, status code, and response time:

```
<-- GET /
--> GET / 200 12ms
<-- GET /api/users
--> GET /api/users 200 45ms
```

### Custom Log Format

Create a custom logger for more control:

```typescript
import { Hono } from "hono";

const app = new Hono();

app.use("*", async (c, next) => {
  const start = performance.now();
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`);

  await next();

  const duration = Math.round(performance.now() - start);
  console.log(
    `[${
      new Date().toISOString()
    }] ${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`,
  );
});

export default app;
```

## Custom Logging

### Console Logging

Use standard console methods for simple logging:

```typescript
// Log levels
console.log("Info message");
console.debug("Debug message");
console.warn("Warning message");
console.error("Error message");

// Structured logging with objects
console.log("User action:", { userId: "123", action: "login" });
```

### Conditional Logging

Log based on environment:

```typescript
import { isDevelopment } from "@udibo/juniper/utils/env";

function debugLog(...args: unknown[]) {
  if (isDevelopment()) {
    console.debug("[DEBUG]", ...args);
  }
}

debugLog("Loader executed", { params });
```

## OpenTelemetry Integration

Deno has built-in OpenTelemetry support that automatically instruments
`console.log`, `Deno.serve`, and `fetch` calls.

### Enabling OpenTelemetry

Enable OpenTelemetry with the `OTEL_DENO` environment variable:

```bash
# Run with OpenTelemetry enabled
OTEL_DENO=true deno run --allow-net --allow-env server.ts

# Or use environment variables in your .env file
OTEL_DENO=true
OTEL_SERVICE_NAME=my-juniper-app
```

Configure the Deno task in your `deno.json`:

```json
{
  "tasks": {
    "dev": {
      "description": "Runs the development server with OTEL.",
      "command": "export OTEL_DENO=true && export OTEL_SERVICE_NAME=dev && deno run -P=dev --env-file @udibo/juniper/dev --project-root ."
    }
  }
}
```

### Auto-Instrumentation

With `OTEL_DENO=true`, Deno automatically exports:

- **Traces** from `Deno.serve()` HTTP requests
- **Traces** from `fetch()` calls
- **Logs** from `console.log()` and other console methods

By default, telemetry is exported to `localhost:4318` using OTLP over HTTP.

### Custom Traces and Spans

Use Juniper's `otelUtils` for simple tracing:

```typescript
// utils/otel.ts
import { otelUtils } from "@udibo/juniper/utils/otel";

const { startActiveSpan } = otelUtils();
export { startActiveSpan };
```

Wrap operations in spans:

```typescript
// services/user.ts
import { startActiveSpan } from "@/utils/otel.ts";

export class UserService {
  async getUser(id: string) {
    return startActiveSpan("user.get", async (span) => {
      span.setAttribute("user.id", id);

      const user = await db.get(["users", id]);

      if (!user) {
        span.setAttribute("user.found", false);
        throw new HttpError(404, "User not found");
      }

      span.setAttribute("user.found", true);
      return user;
    });
  }

  async createUser(data: NewUser) {
    return startActiveSpan("user.create", async (span) => {
      span.setAttribute("user.email", data.email);

      const user = await db.create(data);
      span.setAttribute("user.id", user.id);

      return user;
    });
  }
}
```

Spans with options:

```typescript
import { SpanKind } from "@opentelemetry/api";

startActiveSpan(
  "external-api-call",
  {
    kind: SpanKind.CLIENT,
    attributes: { "http.url": "https://api.example.com" },
  },
  async (span) => {
    const response = await fetch("https://api.example.com/data");
    span.setAttribute("http.status_code", response.status);
    return response.json();
  },
);
```

### Custom Metrics

Use the OpenTelemetry API for custom metrics:

```typescript
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("my-app");

// Create a counter
const requestCounter = meter.createCounter("app.requests", {
  description: "Number of requests processed",
});

// Create a histogram
const requestDuration = meter.createHistogram("app.request.duration", {
  description: "Request duration in milliseconds",
  unit: "ms",
});

// Use in your code
app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const duration = performance.now() - start;

  requestCounter.add(1, { path: c.req.path, status: c.res.status });
  requestDuration.record(duration, { path: c.req.path });
});
```

### Configuration Options

Configure OpenTelemetry with environment variables:

```bash
# Enable OpenTelemetry
OTEL_DENO=true

# Service identification
OTEL_SERVICE_NAME=my-juniper-app
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.version=1.0.0

# Endpoint configuration (defaults to localhost:4318)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Console log behavior
# "capture" (default) - export as logs AND print to console
# "replace" - export as logs, don't print to console
# "ignore" - don't export, only print to console
OTEL_DENO_CONSOLE=capture
```

## Local Development Setup

For local development, use Grafana's LGTM stack (Loki, Grafana, Tempo, Mimir) to
collect and visualize telemetry data.

### Running LGTM Stack with Docker

Create a `docker-compose.yml` file in your project root with the Grafana LGTM
stack:

```yaml
services:
  lgtm:
    image: docker.io/grafana/otel-lgtm:0.8.1
    container_name: lgtm
    ports:
      - "3000:3000" # Grafana UI
      - "4317:4317" # OTLP gRPC
      - "4318:4318" # OTLP HTTP
    volumes:
      - ./docker/volumes/lgtm/grafana:/data/grafana
      - ./docker/volumes/lgtm/prometheus:/data/prometheus
      - ./docker/volumes/lgtm/loki:/data/loki
    environment:
      - GF_PATHS_DATA=/data/grafana
    restart: unless-stopped
    tty: true
    stdin_open: true
```

Add the `docker/volumes/` directory to your `.gitignore`:

```
docker/volumes/
```

Start the stack:

```bash
docker compose up -d --wait lgtm
```

This provides:

- **Grafana** at http://localhost:3000 (login: admin/admin)
- **OpenTelemetry Collector** accepting OTLP data
- **Loki** for logs
- **Tempo** for traces
- **Mimir** for metrics

### Viewing Traces in Grafana

1. Open Grafana at http://localhost:3000
2. Log in with username `admin` and password `admin`
3. Go to **Explore** in the left sidebar
4. Select **Tempo** as the data source
5. Use the **Search** tab to find traces by service name or trace ID

To view a specific trace:

1. Run your Juniper app with `OTEL_DENO=true`
2. Make some requests to your application
3. In Grafana Explore, search for traces from your service
4. Click on a trace to see the span waterfall

### Viewing Metrics and Logs

**Logs (Loki):**

1. In Grafana Explore, select **Loki** as the data source
2. Use LogQL queries like `{service_name="my-juniper-app"}`
3. View console output from your application

**Metrics (Mimir):**

1. Select **Mimir** or **Prometheus** as the data source
2. Use PromQL queries to explore metrics
3. Create dashboards for key performance indicators

### Development Workflow

For convenience, add tasks to your `deno.json` to start and stop the LGTM stack:

```json
{
  "tasks": {
    "lgtm:start": {
      "description": "Starts the LGTM service.",
      "command": "docker compose up -d --wait lgtm"
    },
    "lgtm:stop": {
      "description": "Stops the LGTM service.",
      "command": "docker compose down lgtm"
    }
  }
}
```

Then start the LGTM stack and run your dev server with OpenTelemetry enabled:

```bash
# Start LGTM stack (waits until ready)
deno task lgtm:start

# Run dev server with OTEL in a separate terminal
deno task dev
```

Ensure your dev task has `OTEL_DENO=true` configured to enable telemetry export.

### Cleanup

Stop the LGTM stack when done:

```bash
deno task lgtm:stop
```

To also remove persistent data, delete the volumes directory:

```bash
rm -rf docker/volumes/lgtm
```

## Best Practices

1. **Use structured logging** - Include context as objects rather than string
   interpolation
2. **Use appropriate log levels** - `debug` for development, `info` for
   important events, `error` for failures
3. **Don't log sensitive data** - Avoid logging passwords, tokens, or PII
4. **Add meaningful span names** - Use descriptive names like `user.create`
   instead of `create`
5. **Set span attributes** - Add relevant context like IDs, counts, and
   durations

## Next Steps

**Next:** [CI/CD](ci-cd.md) - GitHub Actions workflows

**Related topics:**

- [Error Handling](error-handling.md) - Error boundaries and HttpError
- [Deployment](deployment.md) - Deploy to Deno Deploy, Docker, and more
