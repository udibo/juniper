# Middleware Adapters

Juniper provides a set of boilerplate adapters to help you use middleware from various React Router ecosystems with minimal changes.

## Overview

The adapters in `@udibo/juniper/middleware/adapters` help you:

1. **Migrate from Remix** - Adapt Remix loaders and actions to middleware
2. **Use Express middleware** - Adapt Express-style middleware to RR format
3. **Create common patterns** - Auth, logging, error handling, security headers
4. **Compose middleware** - Combine multiple middleware functions
5. **Conditional execution** - Run middleware based on predicates

## Installation

```typescript
import {
  createAuthMiddleware,
  createLoggingMiddleware,
  adaptExpressMiddleware,
  // ... etc
} from "@udibo/juniper/middleware/adapters";
```

## Available Adapters

### Authentication Middleware

Create authentication middleware that works with various auth patterns:

```typescript
import { createAuthMiddleware } from "@udibo/juniper/middleware/adapters";
import { createContext } from "react-router";

const userContext = createContext<User | null>(null);

export const middleware = [
  createAuthMiddleware({
    // Get user from request
    getUser: async (request) => {
      const token = request.headers.get("Authorization")?.replace("Bearer ", "");
      if (!token) return null;
      return await verifyToken(token);
    },
    
    // Redirect if not authenticated
    redirectTo: "/login",
    
    // Store user in context
    contextKey: userContext,
    
    // Skip auth for public paths
    excludePaths: ["/public", "/api/health", "/login"],
  }),
];
```

### Logging Middleware

Add request logging with timing:

```typescript
import { createLoggingMiddleware } from "@udibo/juniper/middleware/adapters";

export const middleware = [
  createLoggingMiddleware({
    logRequest: true,
    logResponse: true,
    logTiming: true,
    logger: (message) => console.log(`[App] ${message}`),
  }),
];
```

### Error Handling

Catch and handle errors gracefully:

```typescript
import { createErrorHandlerMiddleware } from "@udibo/juniper/middleware/adapters";

export const middleware = [
  createErrorHandlerMiddleware({
    logErrors: true,
    onError: (error, { request }) => {
      console.error(`Error on ${request.url}:`, error);
      return new Response("Internal Server Error", { status: 500 });
    },
  }),
];
```

### Security Headers

Add security headers to responses:

```typescript
import { createSecurityHeadersMiddleware } from "@udibo/juniper/middleware/adapters";

export const middleware = [
  createSecurityHeadersMiddleware({
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'",
    strictTransportSecurity: true,
    xFrameOptions: "DENY",
    xContentTypeOptions: true,
    referrerPolicy: "strict-origin-when-cross-origin",
  }),
];
```

### Express Middleware Adapter

Use Express middleware in Juniper:

```typescript
import { adaptExpressMiddleware } from "@udibo/juniper/middleware/adapters";
import cors from "cors";
import helmet from "helmet";

export const middleware = [
  adaptExpressMiddleware(cors({
    origin: "https://example.com",
    credentials: true,
  })),
  adaptExpressMiddleware(helmet()),
];
```

### Remix Adapters

Migrate Remix loaders and actions to middleware:

```typescript
import { adaptRemixLoader, adaptRemixAction } from "@udibo/juniper/middleware/adapters";

// Existing Remix loader
async function remixLoader({ request, params, context }) {
  const user = await getUser(request);
  return { user };
}

// Adapt for Juniper
export const middleware = [
  adaptRemixLoader(remixLoader),
];
```

### Composing Middleware

Combine multiple middleware into one:

```typescript
import { 
  composeMiddleware,
  createAuthMiddleware,
  createLoggingMiddleware,
  createErrorHandlerMiddleware,
} from "@udibo/juniper/middleware/adapters";

const appMiddleware = composeMiddleware(
  createLoggingMiddleware(),
  createErrorHandlerMiddleware(),
  createAuthMiddleware({ /* ... */ }),
);

export const middleware = [appMiddleware];
```

### Conditional Middleware

Run middleware only when conditions are met:

```typescript
import { when, createAuthMiddleware } from "@udibo/juniper/middleware/adapters";

export const middleware = [
  // Only run auth on protected routes
  when(
    ({ url }) => url?.pathname.startsWith("/admin") ?? false,
    createAuthMiddleware({ /* ... */ })
  ),
  
  // Only run logging in production
  when(
    () => process.env.NODE_ENV === "production",
    createLoggingMiddleware()
  ),
];
```

### Function Adapter

Adapt simple functions to middleware:

```typescript
import { adaptFunction } from "@udibo/juniper/middleware/adapters";

async function trackPageView({ request, context }) {
  const url = new URL(request.url);
  await analytics.track("page_view", {
    path: url.pathname,
    user: context.get(userContext),
  });
}

export const middleware = [
  adaptFunction(trackPageView),
];
```

## Migration Examples

### From Remix

**Remix (before):**
```typescript
// app/routes/dashboard.tsx
export async function loader({ request, context }) {
  const user = await requireUser(request);
  return json({ user });
}

export default function Dashboard() {
  const { user } = useLoaderData();
  return <div>Welcome {user.name}</div>;
}
```

**Juniper (after):**
```typescript
// routes/dashboard/index.tsx
import { adaptRemixLoader } from "@udibo/juniper/middleware/adapters";
import type { MiddlewareFunction } from "@udibo/juniper";

const remixLoader = async ({ request }) => {
  const user = await requireUser(request);
  return { user };
};

export const middleware: MiddlewareFunction[] = [
  adaptRemixLoader(remixLoader),
];

export default function Dashboard({ loaderData }) {
  return <div>Welcome {loaderData.user.name}</div>;
}
```

### From Express

**Express (before):**
```typescript
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
```

**Juniper (after):**
```typescript
import { adaptExpressMiddleware } from "@udibo/juniper/middleware/adapters";
import cors from "cors";

export const middleware = [
  adaptExpressMiddleware(cors()),
  // Note: express.json() not needed - Juniper handles request parsing
];
```

### From React Router v6

**React Router v6 (before):**
```typescript
import { createBrowserRouter } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    loader: rootLoader,
    children: [
      {
        path: "protected",
        element: <Protected />,
        loader: protectedLoader,
      }
    ]
  }
]);
```

**Juniper (after):**
```typescript
// routes/main.tsx
export default function Root() {
  return <Outlet />;
}

// routes/protected/index.tsx
import { createAuthMiddleware } from "@udibo/juniper/middleware/adapters";

export const middleware = [
  createAuthMiddleware({
    getUser: async (request) => {
      // Adapt your auth logic
    },
  }),
];

export async function loader({ params }) {
  // Your loader logic
}

export default function Protected({ loaderData }) {
  return <div>Protected</div>;
}
```

## Best Practices

1. **Keep middleware focused** - Each middleware should do one thing well
2. **Order matters** - Middleware runs in order; put logging first, auth second, etc.
3. **Always call next()** - Unless you're intentionally short-circuiting
4. **Handle errors** - Use error handler middleware to catch issues
5. **Test middleware** - Middleware is easy to unit test in isolation

## Type Safety

All adapters are fully typed:

```typescript
import type { MiddlewareFunction } from "@udibo/juniper";
// or
import type { MiddlewareFunction } from "@udibo/juniper/middleware/adapters";
```

The adapters preserve React Router's type safety while adding Juniper-specific enhancements.

## Limitations

1. **Express middleware**: Some Express middleware that depends on Node.js-specific features may not work in the browser
2. **Remix adapters**: Complex Remix features (like `defer`) need manual adaptation
3. **Server-only middleware**: Some middleware should only run on the server (use Hono middleware for those)

## See Also

- [Middleware Documentation](./middleware.md)
- [Migration Guide](./migration.md)
- [React Router Middleware Docs](https://reactrouter.com/)
