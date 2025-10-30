**Warning: This file is old and needs updated**

# HTTP Middleware

Juniper is built on Hono, which means you can use any Hono middleware in your
applications. Middleware functions run before your route handlers and can modify
requests, responses, or add functionality like logging, authentication, and
CORS.

## Using Middleware

### Basic Middleware Usage

Apply middleware to your routes using the `.use()` method:

```typescript
import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();

// Apply logger middleware to all routes
app.use(logger());

app.get("/", (c) => c.text("Hello, World!"));

export default app;
```

### Route-Specific Middleware

Apply middleware to specific routes:

```typescript
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

const app = new Hono();

// Apply basic auth only to admin routes
app.use(
  "/admin/*",
  basicAuth({
    username: "admin",
    password: Deno.env.get("ADMIN_PASSWORD"),
  }),
);

app.get("/", (c) => c.text("Public route"));
app.get("/admin/dashboard", (c) => c.text("Admin dashboard"));

export default app;
```

## Built-in Hono Middleware

Juniper automatically includes several useful middleware:

### Error Handling

Juniper automatically handles errors using `@udibo/http-error`:

```typescript
import { HttpError } from "@udibo/http-error";

app.get("/users/:id", async (c) => {
  const id = c.req.param("id");
  const user = await getUserById(id);

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  return c.json(user);
});
```

### Trailing Slash Handling

Juniper automatically removes trailing slashes from URLs using Hono's
`trimTrailingSlash` middleware.

## Common Hono Middleware

### Logger

Log HTTP requests:

```typescript
import { logger } from "hono/logger";

app.use(logger());
```

### CORS

Enable Cross-Origin Resource Sharing:

```typescript
import { cors } from "hono/cors";

// Basic CORS
app.use(cors());

// Custom CORS configuration
app.use(cors({
  origin: ["http://localhost:3000", "https://myapp.com"],
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
}));
```

### Basic Authentication

Add basic HTTP authentication:

```typescript
import { basicAuth } from "hono/basic-auth";

app.use(
  "/api/*",
  basicAuth({
    username: "api-user",
    password: "secret-key",
  }),
);
```

### Bearer Token Authentication

Validate bearer tokens:

```typescript
import { bearerAuth } from "hono/bearer-auth";

app.use(
  "/api/*",
  bearerAuth({
    token: "your-secret-token",
  }),
);
```

### Rate Limiting

Limit request rates (requires additional setup):

```typescript
import { rateLimiter } from "hono/rate-limiter";

app.use(rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: "draft-6",
  keyGenerator: (c) => c.env?.ip ?? "unknown",
}));
```

### Request ID

Add unique request IDs:

```typescript
import { requestId } from "hono/request-id";

app.use(requestId());

app.get("/", (c) => {
  const id = c.get("requestId");
  return c.json({ requestId: id });
});
```

### Compression

Compress responses:

```typescript
import { compress } from "hono/compress";

app.use(compress());
```

### Security Headers

Add security headers:

```typescript
import { secureHeaders } from "hono/secure-headers";

app.use(secureHeaders());
```

## Custom Middleware

Create your own middleware functions:

### Simple Custom Middleware

```typescript
import { createMiddleware } from "hono/factory";

const customLogger = createMiddleware(async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
  console.log(`Response: ${c.res.status}`);
});

app.use(customLogger);
```

### Middleware with Configuration

```typescript
import { createMiddleware } from "hono/factory";

interface TimingOptions {
  header?: string;
}

const timing = (options: TimingOptions = {}) => {
  return createMiddleware(async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;

    const header = options.header || "X-Response-Time";
    c.res.headers.set(header, `${duration}ms`);
  });
};

app.use(timing({ header: "X-Duration" }));
```

### Authentication Middleware

```typescript
import { createMiddleware } from "hono/factory";
import { HttpError } from "@udibo/http-error";

const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new HttpError(401, "Missing authorization token");
  }

  try {
    const user = await validateToken(token);
    c.set("user", user);
    await next();
  } catch (error) {
    throw new HttpError(401, "Invalid token");
  }
});

app.use("/api/protected/*", authMiddleware);

app.get("/api/protected/profile", (c) => {
  const user = c.get("user");
  return c.json({ user });
});
```

## Middleware Order

Middleware runs in the order it's defined. Place middleware that should run
first at the top:

```typescript
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { compress } from "hono/compress";

const app = new Hono();

// Order matters!
app.use(logger()); // 1. Log requests first
app.use(cors()); // 2. Handle CORS
app.use(compress()); // 3. Compress responses
app.use(authMiddleware); // 4. Authenticate users

app.get("/", (c) => c.text("Hello, World!"));

export default app;
```

## Environment-Specific Middleware

Use environment utilities to conditionally apply middleware:

```typescript
import { isDevelopment, isProduction } from "@udibo/juniper/utils/env";
import { logger } from "hono/logger";
import { compress } from "hono/compress";

const app = new Hono();

// Only log in development
if (isDevelopment()) {
  app.use(logger());
}

// Only compress in production
if (isProduction()) {
  app.use(compress());
}

export default app;
```

## Route-Level Middleware Organization

Organize middleware at different route levels:

```typescript
// routes/main.ts - Global middleware
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

const app = new Hono();

app.use(logger());
app.use(cors());

export default app;
```

```typescript
// routes/api/main.ts - API-specific middleware
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";

const app = new Hono();

app.use(bearerAuth({ token: "api-token" }));

export default app;
```

```typescript
// routes/api/admin/main.ts - Admin-specific middleware
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

const app = new Hono();

app.use(basicAuth({
  username: "admin",
  password: Deno.env.get("ADMIN_PASSWORD"),
}));

export default app;
```

## Error Handling in Middleware

Handle errors properly in custom middleware:

```typescript
import { createMiddleware } from "hono/factory";
import { HttpError } from "@udibo/http-error";

const databaseMiddleware = createMiddleware(async (c, next) => {
  try {
    const db = await connectToDatabase();
    c.set("db", db);
    await next();
  } catch (error) {
    console.error("Database connection failed:", error);
    throw new HttpError(500, "Database unavailable");
  }
});
```

## Best Practices

### 1. Keep Middleware Focused

Each middleware should have a single responsibility:

```typescript
// Good: Focused middleware
const authMiddleware = createMiddleware(async (c, next) => {
  // Only handle authentication
  const user = await authenticate(c);
  c.set("user", user);
  await next();
});

const loggingMiddleware = createMiddleware(async (c, next) => {
  // Only handle logging
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
});
```

### 2. Use Appropriate Middleware Scope

Apply middleware at the right level:

```typescript
// Global middleware in routes/main.ts
app.use(logger());
app.use(cors());

// API middleware in routes/api/main.ts
app.use(rateLimiter());

// Admin middleware in routes/api/admin/main.ts
app.use(adminAuth());
```

### 3. Handle Errors Gracefully

Always handle potential errors in middleware:

```typescript
const safeMiddleware = createMiddleware(async (c, next) => {
  try {
    // Middleware logic
    await next();
  } catch (error) {
    console.error("Middleware error:", error);
    throw new HttpError(500, "Internal server error");
  }
});
```

### 4. Document Custom Middleware

Add clear documentation for custom middleware:

```typescript
/**
 * Validates API keys from the X-API-Key header
 * @param validKeys Array of valid API keys
 * @returns Middleware function
 */
const apiKeyAuth = (validKeys: string[]) => {
  return createMiddleware(async (c, next) => {
    const apiKey = c.req.header("X-API-Key");

    if (!apiKey || !validKeys.includes(apiKey)) {
      throw new HttpError(401, "Invalid API key");
    }

    await next();
  });
};
```
