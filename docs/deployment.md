# Deployment

## Overview

Juniper applications can be deployed to various platforms. This guide covers
building for production and deploying to Deno Deploy, Docker containers, and
other platforms.

## Production Build

Before deploying, create a production build:

```bash
# Build with production optimizations
deno task build:prod
```

The template's `.env.production` sets `APP_ENV=production` and
`NODE_ENV=production`. With those values the default build:

- Minifies JavaScript bundles
- Removes source maps
- Enables tree shaking
- Optimizes for smaller bundle sizes

Keep the template's build and serve permission profiles and production tasks in
`deno.json`:

```json
{
  "tasks": {
    "build:prod": {
      "description": "Builds the application for production.",
      "command": "deno run -P=build --env-file --env-file=.env.production build.ts"
    },
    "serve:prod": {
      "description": "Starts the production server.",
      "command": "deno run -P=serve --env-file --env-file=.env.production main.ts"
    }
  }
}
```

## Deno Deploy

Deno Deploy can build and run a Juniper application from a linked repository.
Configure a dynamic application rather than a static `public/` deployment:
Juniper needs its server entrypoint for SSR and server loaders/actions.

### Deployment Steps

1. **Create an application** using the current
   [Deno Deploy build configuration](https://docs.deno.com/deploy/reference/builds/).

2. **Connect your GitHub repository**

3. **Configure the build settings:**
   - **Install command:** `deno install --frozen`
   - **Build command:** `deno task build:prod`
   - **Entrypoint:** `./main.ts`

4. **Configure environment variables** for both the build and runtime contexts.
   Set `APP_ENV=production` and `NODE_ENV=production` in each production
   context.

Deno Deploy supports automatic builds from connected GitHub repositories. Its
[runtime is serverless](https://docs.deno.com/deploy/reference/runtime/), so an
idle application may stop and a later request may need to start it. Use
[pending navigation feedback](routing.md#pending-navigation) independently of
the hosting platform.

### Environment Variables

Set environment variables in the Deno Deploy dashboard:

1. Go to Project Settings > Environment Variables
2. Add required variables (see
   [Environment Configuration](#environment-configuration) for the full list)

### Custom Domains

1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS according to the provided instructions

### Deno Deploy Classic

For Deno Deploy Classic (without build step), see
[CI/CD](ci-cd.md#deploy-to-deno-deploy-classic) for GitHub Actions
configuration.

## Docker

Deploy Juniper applications using Docker for self-hosted environments.

### Dockerfile

Create a `Dockerfile` in your project root:

```dockerfile
FROM denoland/deno:latest

WORKDIR /app

# Cache dependencies
COPY deno.json deno.lock ./
RUN deno install

# Copy application files
COPY . .

# Build the application
RUN deno task build:prod

# Expose the port
EXPOSE 8000

# Run the application
CMD ["deno", "task", "serve:prod"]
```

### Multi-Stage Build

To separate building from serving, use a multi-stage build. The runtime needs
both generated entrypoints, the complete SSR import graph, assets, and runtime
dependencies. Copying only `main.ts`, `routes/`, and `public/` omits `main.tsx`
and application imports such as `components/` and `services/`.

```dockerfile
FROM denoland/deno:latest AS builder

WORKDIR /app
COPY . .
RUN deno install --frozen
RUN deno task build:prod

FROM denoland/deno:latest

WORKDIR /app

COPY --from=builder /app/ ./
RUN deno install --frozen

ENV APP_ENV=production
ENV NODE_ENV=production

EXPOSE 8000

CMD ["deno", "task", "serve:prod"]
```

Pin the same tested Deno image version or digest in both stages. Exclude local
secrets, databases, and host `node_modules/` from the build context with
`.dockerignore`; provide secrets at runtime. A copied subdirectory from a Deno
workspace also needs the workspace configuration and referenced members, or a
standalone configuration. Build the final image in CI and smoke-test it before
shipping it; a successful browser bundle build alone does not verify SSR.

### Docker Compose

Create a `docker-compose.yml` for local testing:

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - APP_ENV=production
      - APP_NAME=My Juniper App
    volumes:
      - app-data:/app/data

volumes:
  app-data:
```

Run with:

```bash
docker compose up -d
```

## Long-Running Servers and Other Platforms

A VM or container host can run `deno task serve:prod` continuously. Configure
process supervision, HTTPS termination, health checks, restart policy, and
durable storage with that host's tools. The generated entrypoint uses
`Deno.serve`; publishing a container port does not change the port on which the
process listens.

For a host that requires a specific listener, create your own entrypoint
alongside generated `main.ts`:

```ts
import { server } from "./main.ts";

Deno.serve({ hostname: "0.0.0.0", port: 8080 }, server.fetch);
```

Run this file with the same permissions and production environment as
`serve:prod`. Importing `main.ts` does not start its listener because its
`import.meta.main` guard is false. Keep this custom entrypoint separate from
generated files, which the builder replaces.

Juniper's generated server targets Deno. A platform with another runtime or a
function-specific request interface needs a verified adapter and a way to serve
the build assets; a Hono adapter alone does not establish compatibility with
Juniper's SSR, filesystem, or streaming requirements.

## Environment Configuration

### Environment Variables

Configure these environment variables for your production deployment. How you
set them depends on your deployment platform (Deno Deploy dashboard, Docker
environment, CI/CD secrets, etc.).

#### Application Variables

| Variable   | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| `APP_NAME` | Your application name, used in logging and error messages      |
| `APP_ENV`  | Environment name: `development`, `test`, or `production`       |
| `NODE_ENV` | Set to `production` for production builds (used by some tools) |

`APP_NAME` is optional; set it to give your application a useful identity. Keep
build-time and server runtime production settings consistent. Only allowlisted
environment values are included in browser hydration data; see
[environment configuration](configuration.md#environment-variables).

#### OpenTelemetry Variables

If you want telemetry in production, also configure:

| Variable            | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `OTEL_DENO`         | Set to `true` to enable OpenTelemetry                |
| `OTEL_SERVICE_NAME` | Service name for traces and metrics (e.g., `my-app`) |

See [Logging](logging.md) for more details on OpenTelemetry configuration.

### Production Environment File

Create a `.env.production` file (not committed to version control if it contains
secrets):

```bash
APP_ENV=production
NODE_ENV=production
```

For sensitive values, use your platform's secret management:

- **Deno Deploy**: Dashboard environment variables
- **Docker**: Environment variables or Docker secrets
- **Fly.io**: `fly secrets set`
- **AWS**: AWS Secrets Manager or Parameter Store

### Environment-Specific Configuration

Use environment variables to configure different behaviors:

```typescript
import { isProduction } from "@udibo/juniper/utils/env";

// Adjust logging
if (isProduction()) {
  // Minimal logging in production
}

// Configure caching
const cacheMaxAge = isProduction() ? 3600 : 0;
```

## Performance Optimization

### Caching Headers

Juniper automatically applies cache headers to build artifacts:

- **`/build/main.js`**: Uses `no-cache` with ETag validation. Caches may store
  it but must validate it before reuse.
- **Other `/build/*` files**: Cached for 4 hours. Lazy JavaScript chunks have
  content hashes; explicit entries such as `main.css` can have stable names.

You can override these defaults in your route handlers. See
[Static Files - Cache Headers](static-files.md#cache-headers) for details on
customizing cache behavior.

### Deploying New Bundles

Publish server code and assets from the same build together. Retain older hashed
chunks when your infrastructure allows it so open tabs can finish loading their
original build. Avoid immutable caching for stable filenames.

An open tab can still request a removed lazy chunk after a deployment. Juniper
can recover with a full document navigation to the intended destination. This
recovery is bounded so persistent failures reach an error boundary instead of
causing a reload loop. It does not replace atomic deployment or error
monitoring. See
[pending navigation and recovery](routing.md#pending-navigation).

If a reverse proxy buffers streamed HTML or loader responses, users will not see
incremental results until the proxy releases the body. Test fallback timing
through the production proxy, including a slow loader and a removed old chunk.

### Compression

Enable compression for text responses:

```typescript
import { compress } from "hono/compress";

app.use(compress());
```

### Bundle Size

Optimize bundle size by:

- Using dynamic imports for large dependencies
- Removing unused code with tree shaking
- Analyzing the bundle with esbuild's analyze option

### Memory and CPU

For production workloads:

- Set appropriate memory limits in your deployment configuration
- Use Deno's `--v8-flags` for V8 tuning if needed
- Monitor performance with OpenTelemetry

### Database Connections

Reuse database connections within a process and close them during shutdown.
Choose pool limits using the database's connection budget and the maximum number
of application instances. Local files and in-memory caches are not shared
between instances; use durable storage for data that must survive restarts. See
[database integration](database.md).

## Health Checks

Add health check endpoints for monitoring:

```typescript
// routes/api/health.ts
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", async (c) => {
  try {
    using kv = await Deno.openKv();
    await kv.get(["health-check"]);
    return c.json({ status: "ready" });
  } catch {
    return c.json({ status: "not ready" }, 503);
  }
});

export default app;
```

Configure your platform to use these endpoints for health monitoring.

## Next Steps

**Next:** [Tutorials](tutorials/README.md) - Step-by-step guides for building
applications

**Related topics:**

- [CI/CD](ci-cd.md) - GitHub Actions workflows
- [Logging](logging.md) - Logging and OpenTelemetry
- [Configuration](configuration.md) - Project and build configuration
