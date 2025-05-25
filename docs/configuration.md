# Configuration

Juniper applications are configured through `deno.json` and environment
variables. This guide covers all configuration options and best practices.

## deno.json Configuration

The `deno.json` file is the main configuration file for your Juniper
application.

### Basic Configuration

```json
{
  "name": "my-juniper-app",
  "description": "My Juniper application",
  "exports": {
    ".": "./main.ts"
  },
  "tasks": {
    "serve": "deno run -A --env-file main.ts",
    "build": "deno run -A --env-file build.ts",
    "test": "deno test -A --env-file"
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

### Tasks

Define common development tasks:

```json
{
  "tasks": {
    "serve": {
      "description": "Start the development server",
      "command": "deno run -A --env-file main.ts"
    },
    "build": {
      "description": "Build the application",
      "command": "deno run -A --env-file build.ts"
    },
    "test": {
      "description": "Run tests",
      "command": "deno test -A --env-file"
    },
    "lint": {
      "description": "Lint the code",
      "command": "deno lint"
    },
    "fmt": {
      "description": "Format the code",
      "command": "deno fmt"
    },
    "check": {
      "description": "Type check the code",
      "command": "deno check **/*.ts"
    }
  }
}
```

### Import Maps

Configure dependencies using import maps:

```json
{
  "imports": {
    // Juniper module
    "@udibo/juniper": "jsr:@udibo/juniper@^0.0.1",

    // Core dependencies
    "hono": "npm:hono@^4",
    "react": "npm:react@^18",
    "react-dom": "npm:react-dom@^18",

    // Utilities
    "@std/assert": "jsr:@std/assert@1",
    "@std/testing": "jsr:@std/testing@1",
    "@std/path": "jsr:@std/path@1",
    "@std/fs": "jsr:@std/fs@1",

    // Error handling
    "@udibo/http-error": "jsr:@udibo/http-error@0.10"
  }
}
```

### Compiler Options

Configure TypeScript compilation:

```json
{
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
    "jsxImportSourceTypes": "@types/react",
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Node Modules

Enable Node.js compatibility when needed:

```json
{
  "nodeModulesDir": "auto"
}
```

### Unstable Features

Enable Deno unstable features:

```json
{
  "unstable": ["kv", "ffi", "worker"]
}
```

### Permissions

Configure default permissions for tasks:

```json
{
  "tasks": {
    "serve": "deno run --allow-net --allow-read --allow-env main.ts",
    "build": "deno run --allow-read --allow-write --allow-env build.ts"
  }
}
```

## Environment Variables

### Environment Files

Juniper supports multiple environment files:

- `.env` - Default environment variables
- `.env.production` - Production-specific variables
- `.env.test` - Test-specific variables
- `.env.local` - Local overrides (should be gitignored)

### Loading Environment Files

Environment files are loaded automatically when using the `--env-file` flag:

```bash
# Loads .env by default
deno run --env-file main.ts

# Load specific environment file
deno run --env-file=.env.production main.ts

# Load multiple environment files
deno run --env-file --env-file=.env.production main.ts
```

### Environment Variables

#### Application Environment

```bash
# .env
APP_ENV=development

# .env.production
APP_ENV=production

# .env.test
APP_ENV=test
```

### Using Environment Variables

Access environment variables in your code:

```typescript
import { isDevelopment, isProduction, isTest } from "@udibo/juniper/utils/env";

// Environment detection
if (isDevelopment()) {
  console.log("Development mode");
}

// Direct access
const port = parseInt(Deno.env.get("PORT") || "8000");
const host = Deno.env.get("HOST") || "localhost";

// With defaults
const dbUrl = Deno.env.get("DATABASE_URL") || "sqlite:./dev.db";
const jwtSecret = Deno.env.get("JWT_SECRET") || "dev-secret";

// Boolean values
const enableAnalytics = Deno.env.get("ENABLE_ANALYTICS") === "true";
```

## OpenTelemetry Configuration

Configure observability with OpenTelemetry:

### Environment Variables

```bash
# OpenTelemetry settings
OTEL_DENO=true
OTEL_SERVICE_NAME=my-juniper-app
```

### Task Configuration

```json
{
  "tasks": {
    "serve": "export OTEL_DENO=true OTEL_SERVICE_NAME=MyApp && deno run -A --env-file --unstable-otel main.ts"
  }
}
```

## Best Practices

### 1. Use Environment-Specific Files

Organize environment variables by environment:

```
.env                # Default values
.env.production     # Production values
.env.test           # Test values
.env.local          # Local overrides (gitignored)
```

### 2. Validate Environment Variables

Always validate critical environment variables:

```typescript
const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];

for (const envVar of requiredEnvVars) {
  if (!Deno.env.get(envVar)) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

### 3. Use Sensible Defaults

Provide defaults for non-critical configuration:

```typescript
const config = {
  port: parseInt(Deno.env.get("PORT") || "8000"),
  host: Deno.env.get("HOST") || "localhost",
  logLevel: Deno.env.get("LOG_LEVEL") || "info",
};
```

### 4. Keep Secrets Secure

Never commit secrets to version control:

```gitignore
# .gitignore
.env.local
.env.production
*.key
*.pem
```
