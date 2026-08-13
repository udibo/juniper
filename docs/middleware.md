# Middleware

## Overview

Juniper supports two types of middleware:

1. **Server Middleware (Hono)** - Runs on every HTTP request on the server
2. **Client Middleware (React Router)** - Runs during client-side navigation

Both can set values on the context object and transform requests/responses.

### React Router Compatibility

Juniper's client middleware is fully compatible with React Router's middleware API. This means:

- **Middleware from other React Router apps works with minimal changes**
- You can import and use middleware from npm packages designed for React Router
- Juniper's `MiddlewareFunction` type is compatible with React Router's
- All React Router middleware arguments (`request`, `params`, `context`, `url`, `pattern`) are available

```typescript
// This middleware from a React Router app works directly in Juniper
import type { MiddlewareFunction } from "react-router";

export const myMiddleware: MiddlewareFunction = async ({ request, context }, next) => {
  // Your middleware logic
  return next();
};

export const middleware = [myMiddleware];
```

No wrapper or adapter needed - just import and use!

## Server Middleware (Hono)

Server middleware uses Hono's middleware system and runs on every HTTP request.

### Creating Hono Middleware

Define middleware in your `main.ts` file using `app.use()`:

```typescript
// routes/main.ts
import { Hono } from "hono";
import type { AppEnv } from "@udibo/juniper/server";

const app = new Hono<AppEnv>();

// Middleware that runs on all requests
app.use(async (c, next) => {
  const start = Date.now();

  await next(); // Call downstream handlers

  // After response
  const duration = Date.now() - start;
  console.log(`Request took ${duration}ms`);
});

export default app;
```

Access the Juniper context from the Hono context:

```typescript
app.use(async (c, next) => {
  const context = c.get("context"); // RouterContextProvider

  // Set values for downstream loaders and components
  const user = await getUser(c.req.header("Authorization"));
  context.set(userContext, user);

  await next();
});
```

### Built-in Hono Middleware

Hono provides many built-in middleware modules:

```typescript
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { compress } from "hono/compress";
import { timing } from "hono/timing";

const app = new Hono();

// Request/response logging
app.use(logger());

// CORS headers
app.use(cors({
  origin: ["https://example.com"],
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
}));

// Security headers
app.use(secureHeaders());

// Response compression
app.use(compress());

// Server timing headers
app.use(timing());
```

See
[Hono's middleware documentation](https://hono.dev/docs/middleware/builtin/basic-auth)
for the full list.

### Middleware Order

Middleware executes in the order defined. Earlier middleware wraps later
middleware:

```typescript
app.use(first); // Runs first, completes last
app.use(second); // Runs second
app.use(third); // Runs third, completes first

// Execution order:
// first (before next) → second (before next) → third
// third (after next) → second (after next) → first (after next)
```

Path-specific middleware runs only for matching routes:

```typescript
// All routes
app.use(logger());

// Only /api/* routes
app.use("/api/*", cors());

// Only /admin/* routes
app.use("/admin/*", requireAdmin);
```

### Common Patterns

#### Authentication

Set user context from authentication tokens:

```typescript
// routes/main.ts
import { Hono } from "hono";
import { createContext } from "react-router";
import type { AppEnv } from "@udibo/juniper/server";

export interface User {
  id: string;
  name: string;
  email: string;
}

export const userContext = createContext<User | null>();

const app = new Hono<AppEnv>();

app.use(async (c, next) => {
  const context = c.get("context");
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  let user: User | null = null;
  if (token) {
    user = await verifyToken(token);
  }

  context.set(userContext, user);
  await next();
});

export default app;
```

Protect routes that require authentication:

```typescript
// routes/admin/main.ts
import { HttpError } from "@udibo/juniper";
import { Hono } from "hono";
import type { AppEnv } from "@udibo/juniper/server";
import { userContext } from "../main.ts";

const app = new Hono<AppEnv>();

app.use(async (c, next) => {
  const context = c.get("context");
  const user = context.get(userContext);

  if (!user) {
    throw new HttpError(401, "Authentication required");
  }

  if (!user.isAdmin) {
    throw new HttpError(403, "Admin access required");
  }

  await next();
});

export default app;
```

#### Logging

Use Hono's built-in logger:

```typescript
import { logger } from "hono/logger";

app.use(logger());
// Output: <-- GET /blog
//         --> GET /blog 200 12ms
```

Custom logging with request IDs:

```typescript
app.use(async (c, next) => {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  console.log(`[${requestId}] ${c.req.method} ${c.req.url}`);

  await next();

  const duration = Date.now() - start;
  console.log(`[${requestId}] ${c.res.status} ${duration}ms`);
});
```

#### Request Validation

Validate content type for API routes:

```typescript
import { HttpError } from "@udibo/juniper";

app.use("/api/*", async (c, next) => {
  const contentType = c.req.header("Content-Type");

  if (c.req.method !== "GET" && !contentType?.includes("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json");
  }

  await next();
});
```

Rate limiting:

```typescript
const requestCounts = new Map<string, number>();

app.use(async (c, next) => {
  const ip = c.req.header("x-forwarded-for") || "unknown";
  const count = requestCounts.get(ip) || 0;

  if (count >= 100) {
    throw new HttpError(429, "Too many requests");
  }

  requestCounts.set(ip, count + 1);
  await next();
});
```

## Client Middleware

Client middleware is defined in route files (`.tsx` or `.ts`) and runs during client-side
navigation. It's fully compatible with React Router's middleware API.

### Creating Client Middleware

Export a `middleware` array from your route file:

```typescript
// routes/dashboard/index.tsx
import type { MiddlewareFunction } from "@udibo/juniper";

export const middleware: MiddlewareFunction[] = [
  async ({ context, request }, next) => {
    console.log("Dashboard middleware running");

    // Set context values
    context.set(dashboardContext, { loadedAt: new Date() });

    // Call next() to continue to the next middleware or route handler
    return next();
  },
];

export default function Dashboard() {
  return <h1>Dashboard</h1>;
}
```

### Using React Router Middleware Directly

You can use middleware written for React Router apps directly in Juniper:

```typescript
// Import from react-router for maximum compatibility
import type { MiddlewareFunction } from "react-router";

const loggingMiddleware: MiddlewareFunction = async ({ request, url, pattern }, next) => {
  console.log(`Navigating to ${url.pathname} (pattern: ${pattern})`);
  const start = performance.now();
  const result = await next();
  console.log(`Completed in ${performance.now() - start}ms`);
  return result;
};

const authMiddleware: MiddlewareFunction = async ({ context, request }, next) => {
  const token = getAuthToken(request);
  if (!token) {
    throw redirect("/login");
  }
  context.set(userContext, await getUser(token));
  return next();
};

export const middleware = [loggingMiddleware, authMiddleware];
```

### Middleware Arguments

Client middleware receives React Router's standard arguments:

```typescript
interface MiddlewareArgs {
  request: Request;              // The current request
  params: Record<string, string>; // Route parameters
  context: RouterContextProvider; // Shared context object
  url: URL;                      // The URL being navigated to
  pattern: string;               // The route pattern (e.g., "/users/:id")
  // ... and more React Router-specific args
}
```

**Note:** Juniper automatically passes through all React Router middleware arguments, ensuring full compatibility with middleware from other React Router applications.

Example with all arguments:

```typescript
export const middleware: MiddlewareFunction[] = [
  async ({ context, request, params }) => {
    console.log(`Route: ${params.id}`);
    console.log(`URL: ${request.url}`);

    // Set context for downstream components
    context.set(myContext, { timestamp: Date.now() });
  },
];
```

### Shared Middleware

You can define middleware in `.ts` files and reuse it across routes. The build system automatically detects middleware exports in both `.tsx` and `.ts` files:

```typescript
// lib/middleware/auth.ts
import { redirect } from "react-router";
import type { MiddlewareFunction } from "@udibo/juniper";

export const requireAuth: MiddlewareFunction = async ({ context, request }, next) => {
  const session = await getSession(request);
  if (!session) {
    throw redirect("/login");
  }
  context.set(userContext, session.user);
  return next();
};

export const requireAdmin: MiddlewareFunction = async ({ context }, next) => {
  const user = context.get(userContext);
  if (user.role !== "admin") {
    throw redirect("/unauthorized");
  }
  return next();
};
```

```typescript
// routes/admin/index.tsx
import { requireAuth, requireAdmin } from "../../lib/middleware/auth";

export const middleware = [requireAuth, requireAdmin];

export default function AdminPage() {
  return <h1>Admin Dashboard</h1>;
}
```

**Note:** Middleware in `.ts` files must be isomorphic (work in both browser and server environments) if used on the client side.

### Calling Next

You **must** call `next()` to continue the middleware chain (unlike the old API where it was automatic). This matches React Router's behavior:

```typescript
export const middleware: MiddlewareFunction[] = [
  async ({ context }, next) => {
    // Before downstream handlers
    const start = performance.now();

    const result = await next(); // Execute child middleware, loaders, actions, render

    // After downstream handlers complete
    const duration = performance.now() - start;
    console.log(`Route took ${duration}ms`);
    return result; // Pass through the result
  },
];
```

To short-circuit and prevent downstream execution, throw a redirect or error:

```typescript
import { redirect } from "react-router";

export const middleware: MiddlewareFunction[] = [
  async ({ context }) => {
    const user = context.get(userContext);

    if (!user) {
      throw redirect("/login"); // Prevents downstream execution
    }

    // If user exists, next() is called automatically
  },
];
```

### Common Patterns

#### Authentication Guard

Redirect unauthenticated users to login:

```typescript
import { redirect } from "react-router";
import type { MiddlewareFunction } from "@udibo/juniper";
import { userContext } from "@/context/user.ts";

export const middleware: MiddlewareFunction[] = [
  async ({ context }) => {
    const user = context.get(userContext);

    if (!user) {
      throw redirect("/login");
    }
  },
];
```

#### Navigation Tracking

Track page views for analytics:

```typescript
import type { MiddlewareFunction } from "@udibo/juniper";

export const middleware: MiddlewareFunction[] = [
  async ({ request }) => {
    // Send to analytics service
    analytics.trackPageView(request.url);
  },
];
```

#### Feature Flags

Check feature flags before rendering:

```typescript
import { redirect } from "react-router";
import type { MiddlewareFunction } from "@udibo/juniper";
import { featureFlagsContext } from "@/context/features.ts";

export const middleware: MiddlewareFunction[] = [
  async ({ context }) => {
    const flags = context.get(featureFlagsContext);

    if (!flags?.newDashboard) {
      throw redirect("/dashboard-old");
    }
  },
];
```

#### Route Timing

Measure how long routes take to load:

```typescript
import type { MiddlewareFunction } from "@udibo/juniper";

export const middleware: MiddlewareFunction[] = [
  async ({ request }, next) => {
    const start = performance.now();

    await next();

    const duration = performance.now() - start;
    console.log(`${request.url} loaded in ${duration}ms`);
  },
];
```

## When Each Type Runs

| Scenario                  | Server Middleware | Client Middleware |
| ------------------------- | ----------------- | ----------------- |
| Initial page load (SSR)   | Yes               | No                |
| Client-side navigation    | No                | Yes               |
| Form submission to server | Yes               | No                |
| Direct URL access         | Yes               | No                |

Use server middleware for:

- Authentication token verification
- Request logging
- CORS and security headers
- Server-side request validation

Use client middleware for:

- Client-side auth state checks
- Navigation tracking
- Client-side feature flags
- UI-related context setup

## Next Steps

**Next:** [Forms](forms.md) - Form handling with client and server actions

**Related topics:**

- [State Management](state-management.md) - Sharing data across your app
- [Error Handling](error-handling.md) - Error boundaries and HttpError
- [Logging](logging.md) - Logging and OpenTelemetry
