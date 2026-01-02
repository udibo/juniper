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

This runs the build process with `APP_ENV=production`, which:

- Minifies JavaScript bundles
- Removes source maps
- Enables tree shaking
- Optimizes for smaller bundle sizes

The production task should be defined in your `deno.json`:

```json
{
  "tasks": {
    "build:prod": {
      "description": "Builds the application for production.",
      "command": "deno run -P=prod --env-file --env-file=.env.production build.ts"
    },
    "serve:prod": {
      "description": "Starts the production server.",
      "command": "deno run -P=prod --env-file --env-file=.env.production main.ts"
    }
  }
}
```

## Deno Deploy

Deno Deploy is the recommended platform for deploying Juniper applications. It
provides:

- Global edge deployment
- Automatic builds and deployment
- Automatic HTTPS
- Built-in KV database

### Deployment Steps

1. **Create a Deno Deploy project** at [dash.deno.com](https://dash.deno.com)

2. **Connect your GitHub repository**

3. **Configure the build settings:**
   - **Install command:** `deno install`
   - **Build command:** `deno task build:prod`
   - **Entrypoint:** `./main.ts`

4. **Configure environment variables** in the Deno Deploy dashboard

Deno Deploy will automatically build and deploy when you push to your configured
branch.

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

For smaller images, use a multi-stage build:

```dockerfile
# Build stage
FROM denoland/deno:latest AS builder

WORKDIR /app
COPY . .
RUN deno task build:prod

# Production stage
FROM denoland/deno:latest

WORKDIR /app

# Copy only necessary files
COPY --from=builder /app/deno.json /app/deno.lock ./
COPY --from=builder /app/main.ts ./
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/public ./public

# Cache dependencies
RUN deno cache main.ts

EXPOSE 8000

CMD ["deno", "task", "serve:prod"]
```

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

## Other Platforms

### Cloudflare Workers

Juniper can be adapted for Cloudflare Workers, though some features may require
adjustment due to the Workers runtime constraints.

**Considerations:**

- Use `@hono/adapter-cloudflare` for Hono compatibility
- Deno KV is not available; use Cloudflare KV or D1
- File system operations are not supported

### AWS Lambda

Deploy to AWS Lambda using a Deno layer:

1. Create a Lambda layer with the Deno runtime
2. Package your application
3. Configure the handler

Or use a container-based Lambda deployment:

```dockerfile
FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.7.0 AS lambda-adapter

FROM denoland/deno:latest

COPY --from=lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app
COPY . .
RUN deno task build:prod

ENV PORT=8080
EXPOSE 8080

CMD ["deno", "task", "serve:prod"]
```

### Fly.io

Deploy to Fly.io with their CLI:

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Initialize the app
fly launch

# Deploy
fly deploy
```

Create a `fly.toml`:

```toml
app = "my-juniper-app"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[env]
  APP_ENV = "production"
```

## Environment Configuration

### Environment Variables

Configure these environment variables for your production deployment. How you
set them depends on your deployment platform (Deno Deploy dashboard, Docker
environment, CI/CD secrets, etc.).

#### Required Variables

| Variable   | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| `APP_NAME` | Your application name, used in logging and error messages      |
| `APP_ENV`  | Environment name: `development`, `test`, or `production`       |
| `NODE_ENV` | Set to `production` for production builds (used by some tools) |

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

Configure appropriate cache headers for static assets:

```typescript
// routes/main.ts
import { Hono } from "hono";

const app = new Hono();

// Cache static files for 1 year (immutable)
app.use("/build/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "public, max-age=31536000, immutable");
});

export default app;
```

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

Use connection pooling for database connections:

```typescript
// For external databases
const pool = new Pool({
  max: 20, // Adjust based on your workload
  idleTimeout: 30000,
});

// For Deno KV (managed by Deno)
const kv = await Deno.openKv();
```

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
  // Check dependencies
  try {
    const kv = await Deno.openKv();
    await kv.get(["health-check"]);
    return c.json({ status: "ready" });
  } catch (error) {
    return c.json({ status: "not ready", error: String(error) }, 503);
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
