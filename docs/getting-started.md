# Getting Started

Juniper is a full-stack React framework for Deno that pairs Hono-based server
routing with React Router on the client. The `@udibo/juniper/build` pipeline
generates the entrypoints that stitch the two halves together so you can focus
on routes, loaders, and middleware instead of glue code.

## Prerequisites

- Deno 2.5 or later (`deno --version`)
- Basic familiarity with React Router and Hono
- A project workspace that can run Deno with the permissions listed in your
  `deno.json`

## 1. Add Juniper to the import map

Juniper is available on JSR. To use it in your project, add it to your
`deno.json` import map:

```json
{
  "imports": {
    "@udibo/juniper": "jsr:@udibo/juniper@^0.0.1",
    "@std/assert": "jsr:@std/assert@^1.0.15",
    "@std/testing": "jsr:@std/testing@^1.0.16",
    "@std/path": "jsr:@std/path@^1.1.2",
    "hono": "npm:hono@^4.10.4",
    "react": "npm:react@^19.2.0",
    "react-dom": "npm:react-dom@^19.2.0",
    "react-router": "npm:react-router@^7.9.5"
  }
}
```

The compiler options in the same file should enable JSX and the DOM libs,
matching the defaults used in this repository.

## 2. Shape the project

Juniper projects expect a minimal layout:

```
my-app/
├── build.ts
├── deno.json
├── public/
│   ├── build/            # Bundled assets written by the builder
│   └── images/
├── routes/
│   ├── main.ts           # Global server middleware
│   └── main.tsx          # Root React layout
└── utils/
```

Everything inside `routes/` participates in file-based routing. Keep shared
helpers in directories prefixed with `_` or outside the routes tree so they are
not registered as URLs.

## 3. Create a builder

Each project needs a thin wrapper around the `Builder` class. A typical
`build.ts` looks like this:

```ts
import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

`projectRoot` tells the builder where to look for `routes/`, `public/`, and
`main.tsx`. When invoked it:

1. Scans the routes directory on the server side and writes `main.ts` that calls
   `createServer`.
2. Scans client `.tsx` routes and writes `main.tsx` that creates a `Client`.
3. Bundles client code (and any extra entrypoints) into `public/build`.

## 4. Add developer tasks

Wire the builder and dev server into `deno.json` tasks. The repo uses the
following commands:

```json
{
  "tasks": {
    "build": "export OTEL_SERVICE_NAME=build && deno run -P=build --env-file ./build.ts",
    "build-prod": "export OTEL_SERVICE_NAME=build && deno run -P=build --env-file --env-file=.env.production ./build.ts",
    "dev": "export OTEL_SERVICE_NAME=dev && deno run -P=dev --env-file ./dev.ts --project-root ./",
    "serve": "deno run -P=serve --env-file ./main.ts",
    "serve-prod": "deno run -P=serve --env-file --env-file=.env.production ./main.ts",
    "test": "deno test -P=test --env-file --env-file=.env.test",
    "check": "deno lint && deno fmt --check"
  }
}
```

The permission profiles defined under `"permissions"` in `deno.json` ensure each
task only receives the capabilities it needs.

## 5. Generate entrypoints

Run the builder once any time the routes tree changes:

```bash
deno task build
```

This produces two generated files:

- `main.ts` – wraps your Hono route tree using `createServer` and automatically
  mounts client rendering for document requests.
- `main.tsx` – exports a `Client` configured with React Router route objects and
  lazy loaders.

Check both files into source control so deployments do not need to run the
builder.

## 6. Start the dev server

`deno task dev` launches `@udibo/juniper/dev`, which:

- Watches your project for file changes.
- Rebuilds `public/build` and regenerates entrypoints as needed.
- Provides live reload via `public/dev-client.js`.

By default it serves the generated server on port `8000`. Pass `--port` to
override:

```bash
deno task dev --port 4000
```

## 7. Serve the application

Use the generated `main.ts` to serve the app in any environment:

```bash
deno task serve          # development env vars
deno task serve-prod     # loads .env.production and removes dev tooling
```

Both tasks call `Deno.serve(server.fetch)` inside the generated entrypoint, so
no additional HTTP wiring is required.

## 8. Verify client hydration

Client bundles import the generated `Client` instance from `/build/main.js`. The
server embeds a hydration script that calls `client.hydrate()` once the bundle
loads. If you need to customize error serialization, export `serializeError`
from `routes/main.ts` and `deserializeError` from `routes/main.tsx`.

## Next steps

- Deep dive into [Configuration](configuration.md) to understand tasks,
  permissions, and environment files.
- Learn how [Routing](routing.md) stitches server and client files together.
- See how to extend behavior with [HTTP Middleware](http-middleware.md).
- Continue with [Development Tools](development-tools.md) for day-to-day
  workflows.
