# Configuration

## Project Configuration (deno.json)

Your project's `deno.json` file configures Deno and defines tasks for your
Juniper application.

```json
{
  "tasks": {
    "dev": "deno run -A @udibo/juniper/dev --project-root .",
    "build": "deno run -A @udibo/juniper/build",
    "build:prod": "deno run -A --env-file=.env.production @udibo/juniper/build",
    "serve": "deno run -A --env-file ./main.ts",
    "serve:prod": "deno run -A --env-file --env-file=.env.production ./main.ts",
    "test": "deno test -A --env-file --env-file=.env.test",
    "check": "deno check && deno lint && deno fmt --check"
  },
  "imports": {
    "@/": "./",
    "@udibo/juniper": "jsr:@udibo/juniper",
    "react": "npm:react@^19",
    "@types/react": "npm:@types/react@^19",
    "react-router": "npm:react-router@^7",
    "hono": "npm:hono@^4"
  },
  "compilerOptions": {
    "lib": ["esnext", "dom", "dom.iterable", "deno.ns"],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "jsxImportSourceTypes": "@types/react"
  }
}
```

**Key import mappings:**

- `@/` - Alias for your project root, allowing imports like
  `@/components/Button.tsx`
- `@udibo/juniper` - The Juniper framework package
- `react` and `react-router` - Core React dependencies
- `hono` - The Hono web framework for server-side routing

## Build Configuration

The build system uses esbuild to bundle your application. By default, you can
use `@udibo/juniper/build` directly without any custom configuration.

For custom build options (like adding esbuild plugins or additional entry
points), create a `build.ts` file in your project root and update your tasks to
use `./build.ts` instead of `@udibo/juniper/build`.

### Builder Options

```typescript
import { Builder } from "@udibo/juniper/build";
import * as path from "@std/path";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));

export const builder = new Builder({
  // Absolute path to the project root (default: current working directory)
  projectRoot,

  // Path to your deno.json configuration file (default: "./deno.json")
  configPath: "./deno.json",

  // Additional esbuild plugins
  plugins: [],

  // Additional entry points to build (e.g., CSS files)
  entryPoints: ["./main.css"],

  // Paths to watch for changes in development (default: projectRoot)
  watchPaths: ["./routes", "./components"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

### Watch Paths Configuration

By default, the development server watches your entire project directory for
file changes. This works well for most projects, but you may need to customize
this behavior if:

- **Permission errors**: Some directories (like Docker volumes) may have
  restricted permissions that prevent Deno from watching them
- **Performance**: Large directories with many files can slow down file watching
- **Noise reduction**: You want to limit rebuilds to specific directories

#### Using `ignorePaths` (Recommended)

The `ignorePaths` option lets you exclude specific directories from file
watching while still watching everything else. This is the recommended approach
because new directories you add to your project will be watched automatically
without updating your configuration.

**Example: Excluding Docker volumes**

If your project contains directories that Deno cannot access (e.g., Docker
volume data), you'll see a `PermissionDenied` error:

```
❌ Dev server error: PermissionDenied: Permission denied (os error 13)
   about ["/home/user/project/docker/volumes/grafana/data"]
```

To fix this, use `ignorePaths` to exclude the problematic directory:

```typescript
// build.ts
import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";
import { postCSSPlugin } from "@udibo/esbuild-plugin-postcss";
import tailwindcss from "@tailwindcss/postcss";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));

export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  // Exclude directories that cause permission errors or shouldn't trigger rebuilds
  ignorePaths: ["./docker"],
  plugins: [
    postCSSPlugin({
      plugins: [tailwindcss()],
    }),
  ],
  entryPoints: ["./main.css"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

**Common directories to ignore:**

- `./docker` - Docker configuration and volume data
- `./data` - Local data directories
- `./logs` - Log files
- `./tmp` - Temporary files

#### Using `watchPaths`

Alternatively, you can use `watchPaths` to explicitly list the directories to
watch. This gives you more control but requires updating your configuration
whenever you add new directories to your project.

```typescript
export const builder = new Builder({
  projectRoot,
  // Only watch these specific directories
  watchPaths: [
    "./routes",
    "./components",
    "./utils",
    "./context",
    "./main.css",
  ],
});
```

**Note:** When using `watchPaths`, new directories won't be watched until you
add them to the list.

### esbuild Plugins

You can add custom esbuild plugins to process files during the build. A common
use case is adding PostCSS with TailwindCSS:

```typescript
import { Builder } from "@udibo/juniper/build";
import { postCSSPlugin } from "@udibo/esbuild-plugin-postcss";
import tailwindcss from "@tailwindcss/postcss";

export const builder = new Builder({
  projectRoot,
  plugins: [
    postCSSPlugin({
      plugins: [tailwindcss()],
    }),
  ],
  entryPoints: ["./main.css"],
});
```

Plugins are inserted after the Deno resolver but before the Deno loader,
allowing you to transform files before they're processed by esbuild.

### Entry Points

Entry points define the files that esbuild should bundle. By default, `main.tsx`
is always included. You can add additional entry points for stylesheets or other
assets:

```typescript
export const builder = new Builder({
  projectRoot,
  entryPoints: [
    "./main.css", // CSS entry point
    "./workers/sw.ts", // Service worker
  ],
});
```

Built files are output to the `public/build/` directory.

## Environment Variables

Juniper provides utilities for working with environment variables across server
and client environments.

### Public Environment Variables

By default, only three environment variables are available on the client:

- `APP_NAME` - The name of your application
- `APP_ENV` - The application environment (`development`, `production`, or
  `test`)
- `NODE_ENV` - The Node.js environment

To expose additional environment variables to the client, export a
`publicEnvKeys` array from your root server route:

```typescript
// routes/main.ts
import { Hono } from "hono";

const app = new Hono();

// These environment variables will be available on both server and client
export const publicEnvKeys = ["API_URL", "FEATURE_FLAGS"];

export default app;
```

Use the `getEnv` function to access environment variables:

```typescript
import { getEnv } from "@udibo/juniper/utils/env";

const apiUrl = getEnv("API_URL");
```

### Server-Only Variables

Environment variables not listed in `publicEnvKeys` are only available on the
server. Use these for sensitive values like API keys and database credentials:

```typescript
// This only works on the server
import { getEnv, isServer } from "@udibo/juniper/utils/env";

if (isServer()) {
  const dbUrl = getEnv("DATABASE_URL");
  const apiKey = getEnv("SECRET_API_KEY");
}
```

### Environment Files

Juniper supports `.env` files for different environments:

- `.env` - Default environment variables (development)
- `.env.production` - Production-specific variables
- `.env.test` - Test-specific variables

Load environment files using the `--env-file` flag:

```bash
# Development (loads .env)
deno run -A --env-file ./main.ts

# Production (loads .env and .env.production)
deno run -A --env-file --env-file=.env.production ./main.ts

# Testing (loads .env and .env.test)
deno test -A --env-file --env-file=.env.test
```

**Environment detection utilities:**

```typescript
import {
  isBrowser,
  isDevelopment,
  isProduction,
  isServer,
  isTest,
} from "@udibo/juniper/utils/env";

if (isDevelopment()) {
  console.log("Running in development mode");
}

if (isProduction()) {
  // Enable production optimizations
}

if (isServer()) {
  // Server-only code
}

if (isBrowser()) {
  // Client-only code
}
```

## TypeScript Configuration

Juniper requires specific TypeScript settings for React JSX support. These are
configured in your `deno.json`:

```json
{
  "compilerOptions": {
    "lib": [
      "esnext",
      "dom",
      "dom.iterable",
      "dom.asynciterable",
      "deno.ns"
    ],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "jsxImportSourceTypes": "@types/react"
  }
}
```

**Required settings:**

- `lib` - Include DOM types for browser APIs and Deno namespace
- `jsx` - Use the new JSX transform (`react-jsx`)
- `jsxImportSource` - Import JSX runtime from React
- `jsxImportSourceTypes` - Use React types for JSX

**Optional settings:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

To exclude build output from formatting and type checking:

```json
{
  "exclude": ["public/build"]
}
```

## Next Steps

**Next:** [Development Tools](development-tools.md) - Hot reload and debugging

**Related topics:**

- [Styling](styling.md) - CSS and TailwindCSS integration
- [Deployment](deployment.md) - Deploy to Deno Deploy, Docker, and more
