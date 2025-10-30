**Warning: This file is old and needs updated**

# Getting Started

Juniper is a web framework for building React applications with Deno. It
combines the power of Hono for server routing with React Router for UI routing,
making it easy to understand your application as a tree.

## Prerequisites

- [Deno](https://deno.land/) 1.40 or later
- Basic knowledge of TypeScript and React

## Installation

Juniper is available on JSR. To use it in your project, add it to your
`deno.json` import map:

```json
{
  "imports": {
    "@udibo/juniper": "jsr:@udibo/juniper@^0.0.1",
    "@udibo/http-error": "jsr:@udibo/http-error@0.10",
    "hono": "npm:hono@^4"
  }
}
```

## Project Setup

### 1. Create Project Structure

Create a new directory for your project and set up the basic structure:

```
my-app/
├── deno.json
├── main.ts
├── routes/
│   └── main.ts
└── public/
```

### 2. Configure deno.json

Create a `deno.json` file with the necessary configuration:

```json
{
  "name": "my-app",
  "version": "0.1.0",
  "tasks": {
    "serve": "deno run -A --env-file main.ts",
    "build": "deno run -A --env-file build.ts"
  },
  "imports": {
    "@udibo/juniper": "jsr:@udibo/juniper@^0.0.1",
    "@udibo/http-error": "jsr:@udibo/http-error@0.10",
    "hono": "npm:hono@^4"
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
  }
}
```

### 3. Create Your First Route

Create a `routes/main.ts` file:

```typescript
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Hello, World!"));

export default app;
```

### 4. Create Build Script

Create a `build.ts` file to generate your main application file:

```typescript
import { buildMainFile } from "@udibo/juniper/build";

const projectRoot = new URL(".", import.meta.url).pathname;
const mainFileContent = await buildMainFile(projectRoot);

await Deno.writeTextFile("main.ts", mainFileContent);
console.log("✅ Generated main.ts");
```

### 5. Generate and Run Your Application

First, generate your main application file:

```bash
deno task build
```

This will create a `main.ts` file that imports and configures all your routes.

Then start your server:

```bash
deno task serve
```

Your application will be available at `http://localhost:8000`.

## File-Based Routing

Juniper uses a file-based routing system where the structure of your `routes/`
directory determines your application's URL structure.

### Route Types

- **`main.ts`** - Main route handler for a path segment
- **`index.ts`** - Index route (handles the exact path)
- **`[...].ts`** - Catch-all route (handles any unmatched paths)
- **`[param].ts`** - Dynamic route with parameter
- **Regular files** - Create routes based on filename

### Examples

```
routes/
├── main.ts              # Handles /
├── hello.ts             # Handles /hello
├── api/
│   ├── main.ts          # Handles /api
│   ├── users.ts         # Handles /api/users
│   └── hello/
│       ├── index.ts     # Handles /api/hello
│       └── [name].ts    # Handles /api/hello/:name
└── blog/
    └── [slug]/
        └── main.ts      # Handles /blog/:slug
```

### Route File Structure

Each server route file should export a Hono app as the default export:

```typescript
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Hello from this route!"));
app.post("/", async (c) => {
  const body = await c.req.json();
  return c.json({ received: body });
});

export default app;
```

## Static Files

Juniper automatically serves static files from a `public/` directory in your
project root. Any files placed in this directory will be served at the root of
your application.

```
public/
├── favicon.ico
├── styles.css
└── images/
    └── logo.png
```

These files will be available at `/favicon.ico`, `/styles.css`, and
`/images/logo.png` respectively.

## Environment Utilities

Juniper provides utilities for working with environment variables:

```typescript
import { isDevelopment, isProduction, isTest } from "@udibo/juniper/utils/env";

if (isDevelopment()) {
  console.log("Running in development mode");
}

if (isProduction()) {
  console.log("Running in production mode");
}
```

The environment is determined by the `APP_ENV` environment variable:

- `development` (default)
- `production`
- `test`

## Next Steps

- Learn about [API route creation](routing.md)
- Explore [middleware usage](http-middleware.md)
- Set up [development tools](development-tools.md)
