**Warning: This file is old and needs updated**

# Routing

Juniper uses a file-based routing system that automatically generates routes
based on the structure of your `routes/` directory. This approach makes it easy
to understand your application's URL structure at a glance.

## File-Based Routing Basics

The routing system maps files and directories in your `routes/` folder to URL
paths. Each route file should export a Hono application as the default export.

### Basic Route Structure

```
routes/
├── main.ts              # Middleware for / and child routes
├── index.ts             # Handles /
├── about.ts             # Handles /about
├── contact.ts           # Handles /contact
└── api/
    ├── main.ts          # Middleware for /api and child routes
    ├── index.ts         # Handles /api
    ├── users.ts         # Handles /api/users
    └── posts.ts         # Handles /api/posts
```

## Route Types

### Main Routes (`main.ts`)

Main routes are primarily used for adding middleware that applies to the current
path and all child routes. They can also handle requests, but typically you
would use `index.ts` for the actual route handler.

```typescript
// routes/main.ts - Global middleware
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

const app = new Hono();

// Add middleware that applies to all routes
app.use(logger());
app.use(cors());

export default app;
```

```typescript
// routes/api/main.ts - API-specific middleware
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";

const app = new Hono();

// Add authentication middleware for all API routes
app.use(bearerAuth({ token: "api-token" }));

export default app;
```

### Index Routes (`index.ts`)

Index routes handle the exact path for their directory. This is where you
typically put the actual route handlers.

```typescript
// routes/index.ts - Handles /
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Welcome to the homepage"));

export default app;
```

```typescript
// routes/api/index.ts - Handles /api
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.json({ message: "API root", version: "1.0" }));

export default app;
```

### Regular File Routes

Any `.ts` file (except special files) creates a route based on its filename.

```typescript
// routes/about.ts
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("About page"));

export default app;
```

### Dynamic Routes

Use square brackets to create dynamic route segments.

```typescript
// routes/users/[id].ts
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  const id = c.req.param("id");
  return c.json({ userId: id });
});

export default app;
```

### Catch-All Routes (`[...].ts`)

Catch-all routes handle any unmatched paths under their segment.

```typescript
// routes/docs/[...].ts
import { Hono } from "hono";

const app = new Hono();

app.get("/*", (c) => {
  const path = c.req.path;
  return c.text(`Documentation for: ${path}`);
});

export default app;
```

## Dynamic Routing

### Single Parameter Routes

Create dynamic routes by wrapping parameter names in square brackets:

```
routes/
├── users/
│   └── [id].ts          # Matches /users/123, /users/abc, etc.
├── blog/
│   └── [slug].ts        # Matches /blog/my-post, /blog/another-post, etc.
└── products/
    └── [category]/
        └── [id].ts      # Matches /products/electronics/123, etc.
```

```typescript
// routes/users/[id].ts
import { Hono } from "hono";

const app = new Hono();

app.get("/", async (c) => {
  const id = c.req.param("id");
  return c.json(await getUser(id));
});

app.post("/", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  return c.json(await updateUser({ ...body, id }));
});

export default app;
```

### Directory-Level Dynamic Routes

You can also create dynamic directory names:

```
routes/
└── blog/
    └── [slug]/
        ├── main.ts      # Handles /blog/:slug
        ├── comments.ts  # Handles /blog/:slug/comments
        └── edit.ts      # Handles /blog/:slug/edit
```

```typescript
// routes/blog/[slug]/main.ts
import { Hono } from "hono";

const app = new Hono();

app.get("/", async (c) => {
  const slug = c.req.param("slug");
  return c.json(await getPost(slug));
});

export default app;
```

## Route Priority

Routes are processed in a specific order to ensure predictable behavior:

1. **Main routes** (`main.ts`) - Middleware that applies to the current path and
   all child routes
2. **Index routes** (`index.ts`) - Exact path handlers
3. **Regular file routes** (alphabetical order) - Named path handlers
4. **Dynamic routes** (`[param].ts`) - Parameterized path handlers
5. **Catch-all routes** (`[...].ts`) - Fallback handlers for unmatched paths

**Important:** `main.ts` files primarily provide middleware, while `index.ts`
files provide the actual route handlers for exact path matches.

## HTTP Methods

Each route file can handle multiple HTTP methods:

```typescript
// routes/api/users.ts
import { Hono } from "hono";

const app = new Hono();

// GET /api/users
app.get("/", async (c) => {
  return c.json({ users: await getUsers() });
});

// POST /api/users
app.post("/", async (c) => {
  const body = await c.req.json();
  return c.json(await createUser(body), 201);
});

export default app;
```

## Route Parameters

Access route parameters using Hono's `c.req.param()` method:

```typescript
// routes/api/users/[id].ts
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  const id = c.req.param("id");
  return c.json(await getUser(id));
});

// Multiple parameters
// routes/api/users/[userId]/posts/[postId].ts
app.get("/", (c) => {
  const userId = c.req.param("userId");
  const postId = c.req.param("postId");
  return c.json({ user: getUser(userId), post: getPost(postId) });
});

export default app;
```

## Query Parameters

Access query parameters using Hono's `c.req.query()` method:

```typescript
// routes/api/users.ts
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");

  return c.json({
    users: getUsers({ page, limit }),
  });
});

export default app;
```

## Request Body Handling

Handle request bodies using Hono's built-in methods:

```typescript
// routes/api/users.ts
import { Hono } from "hono";

const app = new Hono();

// JSON body
app.post("/", async (c) => {
  const user = await c.req.json();
  return c.json({ created: user }, 201);
});

// Form data
app.post("/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");
  return c.json({ uploaded: file?.name });
});

// Text body
app.post("/webhook", async (c) => {
  const text = await c.req.text();
  return c.json({ received: text });
});

export default app;
```

## Private Routes and Files

Files and directories starting with an underscore (`_`) are ignored by the
routing system:

```
routes/
├── _components/         # Ignored - utility directory
│   └── Header.tsx
├── _utils/             # Ignored - utility directory
│   └── auth.ts
├── users.ts            # Route: /users
├── users.test.ts       # Ignored - test file
└── _private.ts         # Ignored - private file
```

This allows you to organize utility files, components, and tests alongside your
routes without creating unwanted routes.

## Route Generation

Routes are automatically generated when you run the build process. The generated
`main.ts` file contains the complete route configuration:

```typescript
// Generated main.ts
import { createApp } from "@udibo/juniper/server";

export const app = createApp(import.meta.url, {
  path: "/",
  main: await import("./routes/main.ts"),
  children: [
    {
      path: "/api",
      main: await import("./routes/api/main.ts"),
      children: [
        {
          path: "/users",
          main: await import("./routes/api/users.ts"),
          children: [
            {
              path: "/:id",
              main: await import("./routes/api/users/[id].ts"),
            },
          ],
        },
      ],
    },
  ],
});
```

## Best Practices

### 1. Keep Routes Focused

Each route file should handle a specific resource or functionality:

```typescript
// Good: routes/api/users/index.ts
const app = new Hono();
app.get("/", getUserList);
app.post("/", createUser);
export default app;

// Good: routes/api/users/[id].ts
const app = new Hono();
app.get("/", getUser);
app.put("/", updateUser);
app.delete("/", deleteUser);
export default app;
```

### 2. Separate Middleware from Route Handlers

Use `main.ts` for middleware and `index.ts` for route handlers:

```typescript
// Good: routes/api/main.ts - Middleware only
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";

const app = new Hono();
app.use(bearerAuth({ token: "secret" }));
export default app;

// Good: routes/api/index.ts - Route handler only
import { Hono } from "hono";

const app = new Hono();
app.get("/", (c) => c.json({ message: "API root" }));
export default app;
```

### 3. Use Consistent Naming

Follow consistent naming conventions for your route files:

```
routes/
├── users.ts            # Collection routes
├── users/
│   └── [id].ts         # Individual resource routes
├── blog-posts.ts       # Use kebab-case for multi-word resources
└── blog-posts/
    └── [slug].ts
```

### 4. Organize Related Routes

Group related functionality in directories:

```
routes/
├── api/
│   ├── auth/
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   └── refresh.ts
│   ├── users/
│   │   ├── index.ts
│   │   └── [id].ts
│   └── posts/
│       ├── index.ts
│       └── [id].ts
└── admin/
    ├── main.ts
    ├── users.ts
    └── settings.ts
```

### 5. Handle Errors Consistently

Use Juniper's built-in error handling:

```typescript
import { HttpError } from "@udibo/http-error";

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = await getUserById(id);

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  return c.json(user);
});
```

### Examples

```
routes/
├── main.ts              # Global middleware
├── index.ts             # Handles /
├── about.ts             # Handles /about
├── api/
│   ├── main.ts          # API middleware
│   ├── index.ts         # Handles /api
│   ├── users.ts         # Handles /api/users
│   └── hello/
│       ├── main.ts      # Hello middleware
│       ├── index.ts     # Handles /api/hello
│       └── [name].ts    # Handles /api/hello/:name
└── blog/
    ├── main.ts          # Blog middleware
    ├── index.ts         # Handles /blog
    └── [slug]/
        ├── main.ts      # Individual blog post middleware
        └── index.ts     # Handles /blog/:slug
```

## Route-Level Middleware Organization

Organize middleware at different route levels using `main.ts` files:

```typescript
// routes/main.ts - Global middleware for all routes
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

const app = new Hono();

app.use(logger());
app.use(cors());

export default app;
```

```typescript
// routes/index.ts - Homepage handler
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("Welcome to the homepage"));

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
// routes/api/index.ts - API root handler
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.json({ message: "API v1", status: "healthy" }));

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

```typescript
// routes/api/admin/index.ts - Admin dashboard handler
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.json({ message: "Admin Dashboard" }));

export default app;
```
