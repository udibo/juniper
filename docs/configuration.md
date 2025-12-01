# Configuration

This guide explains how Juniper projects are wired through `deno.json`,
environment files, and the `Builder` runtime. Use it as the single source of
truth when creating a new application or reviewing CI/CD pipelines.

## deno.json Anatomy

Every Juniper project should declare the following sections:

```json
{
  "imports": {
    "@udibo/juniper": "jsr:@udibo/juniper@^0.0.1",
    "@udibo/http-error": "jsr:@udibo/http-error@0.10",
    "@std/assert": "jsr:@std/assert@^1.0.15",
    "@std/testing": "jsr:@std/testing@^1.0.16",
    "@std/path": "jsr:@std/path@^1.1.2",
    "hono": "npm:hono@^4.10.4",
    "react": "npm:react@^19.2.0",
    "react-dom": "npm:react-dom@^19.2.0",
    "react-router": "npm:react-router@^7.9.5"
  },
  "compilerOptions": {
    "lib": [
      "esnext",
      "dom",
      "dom.iterable",
      "dom.asynciterable",
      "deno.ns",
      "deno.unstable"
    ],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "jsxImportSourceTypes": "@types/react"
  },
  "nodeModulesDir": "auto",
  "unstable": ["kv"],
  "permissions": {
    "serve": {
      "net": true,
      "env": true,
      "read": true,
      "write": ["./public/build"]
    },
    "build": {
      "env": true,
      "read": true,
      "write": ["./public/build", "./main.ts", "./main.tsx"],
      "run": true
    },
    "dev": {
      "net": true,
      "env": true,
      "read": true,
      "write": ["./public/build", "./main.ts", "./main.tsx"],
      "run": true
    },
    "test": {
      "net": true,
      "env": true,
      "read": true,
      "write": true,
      "run": true
    }
  }
}
```

- **Imports** pull in Juniper and its peer dependencies via the import map.
- **Compiler options** enable JSX via `react-jsx` output so both client and
  server code share React components.
- **Permissions** leverage Deno 2.5 permission profiles so each `deno task`
  receives only the capabilities it needs.
- **Unstable flags** currently opt into `Deno.Kv`, which powers the bundled KV
  service helpers.

## Task Definitions

Map repeatable workflows to tasks. The default repo ships with:

```json
{
  "tasks": {
    "build": "export OTEL_SERVICE_NAME=build && deno run -P=build --env-file ./build.ts",
    "build-prod": "export OTEL_SERVICE_NAME=build && deno run -P=build --env-file --env-file=.env.production ./build.ts",
    "dev": "export OTEL_SERVICE_NAME=dev && deno run -P=dev --env-file ./dev.ts --project-root ./",
    "serve": "deno run -P=serve --env-file ./main.ts",
    "serve-prod": "deno run -P=serve --env-file --env-file=.env.production ./main.ts",
    "test": "deno test -P=test --env-file --env-file=.env.test",
    "test-update": "deno task test -- --update",
    "check": "deno lint && deno fmt --check"
  }
}
```

Key ideas:

- `-P=name` selects the permission profile of the same name.
- `--env-file` loads `.env` automatically; add a second flag to layer
  `.env.production` or `.env.test`.
- `test-update` simply forwards `--update` to `deno test`, so snapshot refreshes
  reuse the same task.

Adopt these commands verbatim or adjust the paths to match your project root.

## Builder Options

Use the `Builder` class when you need custom build hooks. The constructor
accepts:

| Option        | Description                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------- |
| `projectRoot` | Absolute path that contains `routes/`, `public/`, and `main.tsx`. Defaults to `Deno.cwd()`. |
| `configPath`  | Path to `deno.json` or `deno.jsonc`. Used by the esbuild loader.                            |
| `entryPoints` | Additional files (CSS, workers) that should be bundled into `public/build`.                 |
| `watchPaths`  | Glob(s) watched by the dev server. Defaults to the project root.                            |
| `plugins`     | Extra esbuild plugins inserted between the resolver and loader.                             |
| `write`       | Set to `false` in tests to avoid touching the filesystem.                                   |

The builder exposes:

- `build()` – generates entrypoints, creates an esbuild context, writes bundles
  to `public/build`, and stores the context for incremental rebuilds.
- `dispose()` – tears down esbuild and removes the builder from the active set
  so repeated builds do not leak resources.

## Environment Management

Juniper uses `APP_ENV` to determine whether it is running in development,
production, or test (`utils/env.ts`). All server renders capture the current
`APP_ENV` and embed it in the hydration payload so `isDevelopment()`,
`isProduction()`, and `isTest()` behave consistently in the browser.

Recommended file layout:

```
.env              # Shared defaults (development)
.env.production   # Production overrides
.env.test         # Test-only overrides
.env.local        # Ignored secrets per developer
```

The tasks above load `.env` plus one extra file using repeated `--env-file`
flags:

```bash
deno run --env-file --env-file=.env.production ./main.ts
```

When you need environment conditionals in code, import the helpers:

```ts
import { isDevelopment, isProduction, isTest } from "@udibo/juniper/utils/env";

if (isDevelopment()) {
  console.log("Development mode");
}
```

For tests, `@udibo/juniper/utils/testing` exposes `simulateEnvironment` which
wraps test callbacks with temporary variable overrides without polluting the
process.

## Telemetry and Logging

The repository enables OpenTelemetry end to end:

- `utils/otel.ts` exposes `getInstance()` to correlate errors with the active
  span and `otelUtils()` to wrap spans with automatic HttpError propagation.
- Tasks set `OTEL_SERVICE_NAME` so Grafana/Tempo receives a distinct service for
  build, dev, and runtime.
- `server.tsx` sets `error.instance = getInstance()` before logging, which
  surfaces trace IDs in responses.

Set `OTEL_DENO=true` (or rely on your agent's defaults) before running
serve/build commands if you want spans to flow into an external collector.

## Generated Files and Assets

During `deno task build`:

- `main.ts` is regenerated. Commit this file so production servers do not need
  the builder.
- `main.tsx` is regenerated for the client.
- `public/build/main.js` and related chunks are written with React Compiler,
  code splitting, and sourcemaps (in development). Additional entrypoints from
  `entryPoints` are bundled alongside the router bundle.

Static assets placed anywhere under `public/` are served verbatim.

## Checklist

1. Configure `deno.json` with exports/imports, permission profiles, and tasks.
2. Create a `build.ts` that instantiates a `Builder` with the correct
   `projectRoot`.
3. Define `.env*` files plus `APP_ENV` so `utils/env` behaves correctly on both
   server and client.
4. Decide whether to opt into OpenTelemetry by exporting
   `OTEL_SERVICE_NAME`/`OTEL_DENO` in tasks.
5. Commit the generated `main.ts`, `main.tsx`, and `public/build` outputs that
   your deploy target needs.
