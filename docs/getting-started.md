# Getting Started

## Prerequisites

Before you begin, ensure you have [Deno](https://deno.com/) installed on your
system. Juniper requires Deno 2.0 or later.

To install Deno, follow the instructions at [deno.com](https://deno.com/).

Verify your installation:

```bash
deno --version
```

## Quick Start

### Using a Template

The fastest way to get started is by using one of the provided templates. Use
`degit` to clone just the template you need:

**Minimal Template** - A bare-bones setup with just the essentials:

```bash
# Clone the minimal template
deno run -A npm:degit udibo/juniper/templates/minimal my-app
cd my-app

# Install dependencies
deno install

# Start the development server
deno task dev
```

**TailwindCSS Template** - Includes TailwindCSS for styling:

```bash
deno run -A npm:degit udibo/juniper/templates/tailwindcss my-app
cd my-app
deno install
deno task dev
```

**TanStack Template** - Demonstrates TanStack Query integration:

```bash
deno run -A npm:degit udibo/juniper/templates/tanstack my-app
cd my-app
deno install
deno task dev
```

Open your browser to `http://localhost:8000` to see your application.

### Creating from Scratch

To create a new Juniper project manually:

1. Create a new directory and initialize it:

```bash
mkdir my-app
cd my-app
```

2. Create a `deno.json` configuration file:

```json
{
  "tasks": {
    "dev": {
      "description": "Runs the development server.",
      "command": "deno run -P=dev --env-file @udibo/juniper/dev --project-root ."
    },
    "build": {
      "description": "Builds the application for development.",
      "command": "deno run -P=build --env-file @udibo/juniper/build"
    },
    "build:prod": {
      "description": "Builds the application for production.",
      "command": "deno run -P=build --env-file --env-file=.env.production @udibo/juniper/build"
    },
    "serve": {
      "description": "Runs the server in development mode.",
      "command": "deno run -P=serve --env-file ./main.ts"
    },
    "serve:prod": {
      "description": "Runs the server in production mode.",
      "command": "deno run -P=serve --env-file --env-file=.env.production ./main.ts"
    },
    "test": {
      "description": "Runs the tests.",
      "command": "deno test -P=test --env-file --env-file=.env.test"
    },
    "check": {
      "description": "Checks the code for errors, formatting, and runs the linter.",
      "command": "deno check && deno lint && deno fmt --check"
    }
  },
  "imports": {
    "@/": "./",
    "@udibo/juniper": "jsr:@udibo/juniper@^0",
    "@std/testing": "jsr:@std/testing@^1",
    "@std/assert": "jsr:@std/assert@^1",
    "react": "npm:react@^19",
    "@types/react": "npm:@types/react@^19",
    "react-router": "npm:react-router@^7",
    "hono": "npm:hono@^4",
    "@testing-library/react": "npm:@testing-library/react@^16"
  },
  "permissions": {
    "serve": {
      "env": true,
      "read": true,
      "net": true
    },
    "build": {
      "env": true,
      "read": true,
      "write": true,
      "run": true
    },
    "dev": {
      "env": true,
      "read": true,
      "write": true,
      "net": true,
      "run": true
    },
    "test": {
      "env": true,
      "read": true,
      "net": true,
      "run": true
    }
  },
  "compilerOptions": {
    "lib": ["esnext", "dom", "dom.iterable", "deno.ns"],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "jsxImportSourceTypes": "@types/react"
  }
}
```

3. Create the root route at `routes/main.ts`:

```typescript
import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());

export default app;
```

4. Create the root layout at `routes/main.tsx`:

```tsx
import { Outlet } from "react-router";
import type { ErrorBoundaryProps } from "@udibo/juniper";

export default function Main() {
  return (
    <main>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <Outlet />
    </main>
  );
}

export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  return (
    <main>
      <h1>Error</h1>
      <p>{error instanceof Error ? error.message : "An error occurred"}</p>
    </main>
  );
}
```

5. Create your home page at `routes/index.tsx`:

```tsx
export default function Home() {
  return (
    <>
      <title>Home</title>
      <h1>Welcome to Juniper</h1>
    </>
  );
}
```

6. Create environment files for different environments:

**`.env`** - Development settings:

```bash
APP_NAME=my-app
APP_ENV=development
NODE_ENV=development
OTEL_DENO=true
OTEL_SERVICE_NAME=my-app-dev
```

**`.env.production`** - Production settings:

```bash
APP_ENV=production
NODE_ENV=production
```

**`.env.test`** - Test settings (uses a different port so tests can run
alongside the dev server):

```bash
APP_ENV=test
OTEL_SERVICE_NAME=my-app-test
DENO_SERVE_ADDRESS=tcp:0.0.0.0:8100
```

> **Note:** These environment files contain only non-sensitive configuration.
> Store secrets (API keys, database credentials) in your platform's secret
> management or in `.env.local` files that are gitignored.

7. Create a `public` directory for static assets:

```bash
mkdir public
```

8. Run the development server:

```bash
deno task dev
```

## Project Structure

A typical Juniper project has the following structure:

```
my-app/
├── deno.json           # Deno configuration and tasks
├── .env                # Development environment variables
├── .env.production     # Production environment variables
├── .env.test           # Test environment variables
├── main.ts             # Server entry point (auto-generated)
├── main.tsx            # Client entry point (auto-generated)
├── build.ts            # Build configuration (optional)
├── public/             # Static assets
│   ├── favicon.ico
│   └── build/          # Generated build output
├── routes/             # Route files
│   ├── main.ts         # Root server route (Hono app)
│   ├── main.tsx        # Root layout component
│   ├── index.tsx       # Home page (/)
│   └── blog/
│       ├── index.tsx   # Blog list (/blog)
│       └── [id]/
│           └── index.tsx  # Blog post (/blog/:id)
└── components/         # Shared components (optional)
```

**Key directories:**

- `routes/` - Contains all route files. The file structure maps to URL paths.
- `public/` - Static files served directly. The `build/` subdirectory contains
  generated JavaScript and CSS.
- `components/` - Optional directory for shared React components.

**Auto-generated files:**

- `main.ts` - Server entry point, generated by the build system.
- `main.tsx` - Client entry point, generated by the build system.

## Running Your Application

### Development Mode

Start the development server with hot reload:

```bash
deno task dev
```

This will:

- Watch for file changes
- Automatically rebuild when files change
- Refresh the browser after rebuilds

The server runs at `http://localhost:8000` by default.

### Building and Serving

For manual build and serve (useful for testing production builds locally):

```bash
# Build for development
deno task build

# Serve in development mode
deno task serve
```

For production builds with optimizations:

```bash
# Build with production settings
deno task build:prod

# Serve with production settings
deno task serve:prod
```

### Running Tests

Run your test suite on a separate port (8100) so tests don't conflict with the
dev server:

```bash
deno task test
```

### Code Quality

Check formatting, linting, and type errors:

```bash
deno task check
```

## Next Steps

**Next:** [Configuration](configuration.md) - Project and build configuration

**Related topics:**

- [Routing](routing.md) - File-based routing and data loading
- [Middleware](middleware.md) - Server and client middleware
- [Styling](styling.md) - CSS and TailwindCSS integration
