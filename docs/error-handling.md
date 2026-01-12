# Error Handling

## Overview

Juniper provides comprehensive error handling through the `HttpError` class and
React Router's error boundary system. Errors thrown in loaders, actions, or
middleware are automatically caught and rendered by the nearest error boundary.

## HttpError Class

The `HttpError` class from `@udibo/http-error` (re-exported by `@udibo/juniper`)
provides a structured way to throw HTTP errors with appropriate status codes and
messages.

### Creating HTTP Errors

Create HTTP errors by specifying a status code and message:

```typescript
import { HttpError } from "@udibo/juniper";

// 404 Not Found
throw new HttpError(404, "Post not found");

// 400 Bad Request
throw new HttpError(400, "Invalid email format");

// 401 Unauthorized
throw new HttpError(401, "Authentication required");

// 403 Forbidden
throw new HttpError(403, "Access denied");

// 500 Internal Server Error
throw new HttpError(500, "Database connection failed");
```

Use `HttpError.from()` to convert unknown errors to HttpErrors:

```typescript
try {
  await someOperation();
} catch (error) {
  throw HttpError.from(error);
}
```

### Error Exposure

HttpError distinguishes between internal error messages and messages safe to
expose to clients:

```typescript
// Create an error with an exposed message
const error = new HttpError(500, "Database connection failed");

// Internal message (may contain sensitive details)
console.log(error.message); // "Database connection failed"

// Safe message for clients
console.log(error.exposedMessage); // Generic message based on status code
```

The `exposedMessage` property returns a client-safe message that won't leak
sensitive information. For 4xx client errors, the message is typically exposed;
for 5xx server errors, a generic message is returned by default.

### Custom Messages

In error boundaries, use `exposedMessage` for client-facing display:

```tsx
export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  const message = error instanceof HttpError
    ? error.exposedMessage
    : error instanceof Error
    ? error.message
    : "An unexpected error occurred";

  return (
    <div>
      <h1>Error</h1>
      <p>{message}</p>
    </div>
  );
}
```

## Error Boundaries

Error boundaries catch errors thrown during rendering, in loaders, actions, or
middleware, and display fallback UI.

### Route Error Boundaries

Export an `ErrorBoundary` component from your route to handle errors for that
route and its children:

```tsx
// routes/blog/[id].tsx
import { HttpError } from "@udibo/juniper";
import type { ErrorBoundaryProps } from "@udibo/juniper";
import { Link } from "react-router";

export function ErrorBoundary({
  error,
  params,
  resetErrorBoundary,
}: ErrorBoundaryProps<{ id: string }>) {
  return (
    <div className="text-center py-12">
      <h1 className="text-3xl font-bold mb-4">Blog Post Not Found</h1>
      <p className="text-gray-600 mb-6">
        {params.id
          ? `Sorry, we couldn't find a blog post with ID "${params.id}".`
          : "Sorry, we couldn't find that blog post."}
      </p>
      <p className="text-gray-500 mb-8">
        {error instanceof HttpError
          ? error.exposedMessage
          : error instanceof Error
          ? error.message
          : String(error)}
      </p>
      <Link to="/blog">← Back to Blog</Link>
    </div>
  );
}
```

### Sharing Layouts with Error Boundaries

If you want your error boundary to share the same layout as your route
component, you can use the layout wrapper pattern. This keeps navigation and
other shared UI mounted when transitioning to an error state, avoiding
unnecessary re-renders. See
[Routing - Layout Wrapper Pattern](routing.md#layout-wrapper-pattern) for
details.

### ErrorBoundaryProps

The `ErrorBoundaryProps` interface provides access to error details and route
context:

```typescript
interface ErrorBoundaryProps<
  Params = Record<string, string | undefined>,
  LoaderData = unknown,
  ActionData = unknown,
> {
  /** The error that was thrown */
  error: unknown;
  /** A function to reset the error boundary and retry */
  resetErrorBoundary: () => void;
  /** The route params */
  params: Params;
  /** The loader data (if available before the error) */
  loaderData: LoaderData;
  /** The action data (if available before the error) */
  actionData: ActionData;
  /** The router context */
  context: RouterContextProvider;
}
```

Use typed params for better type safety:

```tsx
export function ErrorBoundary({
  error,
  params,
}: ErrorBoundaryProps<{ id: string }>) {
  return (
    <div>
      <h1>Error loading item {params.id}</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
    </div>
  );
}
```

## Error Serialization

Errors thrown on the server are serialized for the client. Juniper handles this
automatically, but you can customize it for custom error types. Juniper's
serialization (used for context, loader data, action data, and errors) supports
all standard JSON types plus: `undefined`, `bigint`, `Date`, `RegExp`, `Set`,
`Map`, `Error`, and `URL`.

### Custom Error Serialization

For custom error classes, use `registerError` to define how errors are
serialized and deserialized. This registration works for both server and client.

**Define and register the custom error:**

```typescript
// errors/custom.ts
import { registerError } from "@udibo/juniper";
import { isDevelopment } from "@udibo/juniper/utils/env";

export class CustomError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "CustomError";
    this.code = code;
  }
}

// Register the error serializer (call this early in your app initialization)
registerError<CustomError>({
  name: "CustomError",
  is: (error): error is CustomError => error instanceof CustomError,
  serialize: (error) => {
    const data: Record<string, unknown> = {
      message: error.message,
      code: error.code,
    };
    if (isDevelopment()) {
      data.stack = error.stack;
    }
    return data;
  },
  deserialize: (data) => {
    const error = new CustomError(
      data.message as string,
      data.code as string,
    );
    if (data.stack) {
      error.stack = data.stack as string;
    }
    return error;
  },
});
```

Import this file in your root route to ensure registration happens:

```typescript
// routes/main.ts
import "@/errors/custom.ts";
```

### Stack Traces

For standard `Error` and `HttpError` classes, Juniper automatically includes
stack traces in development and excludes them in production. For custom errors,
use `isDevelopment()` in your `serialize` function to control when stack traces
are sent to the client, as shown in the example above.

## Common Patterns

### 404 Not Found

Throw 404 errors when resources don't exist:

```typescript
// routes/blog/[id].ts
import { HttpError } from "@udibo/juniper";
import type { RouteLoaderArgs } from "@udibo/juniper";
import { postService } from "@/services/post.ts";

export async function loader({ params }: RouteLoaderArgs<{ id: string }>) {
  const post = await postService.findById(params.id);
  if (!post) {
    throw new HttpError(404, `Post with ID "${params.id}" not found`);
  }
  return { post };
}
```

### Validation Errors

Return validation errors as action data instead of throwing. See
[Forms - Server-Side Validation](forms.md#server-side-validation) for more
details:

```typescript
// routes/blog/create.ts
import type { RouteActionArgs } from "@udibo/juniper";
import { redirect } from "react-router";

interface ActionData {
  errors?: {
    title?: string;
    content?: string;
  };
}

export async function action(
  { request }: RouteActionArgs,
): Promise<ActionData | Response> {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  const errors: ActionData["errors"] = {};

  if (!title || title.length < 3) {
    errors.title = "Title must be at least 3 characters";
  }
  if (!content || content.length < 10) {
    errors.content = "Content must be at least 10 characters";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const post = await postService.create({ title, content });
  return redirect(`/blog/${post.id}`);
}
```

Display validation errors in the component:

```tsx
// routes/blog/create.tsx
import { Form } from "react-router";
import type { RouteProps } from "@udibo/juniper";

export default function CreatePost({ actionData }: RouteProps) {
  return (
    <Form method="post">
      <div>
        <label htmlFor="title">Title</label>
        <input type="text" id="title" name="title" />
        {actionData?.errors?.title && (
          <p className="text-red-500">{actionData.errors.title}</p>
        )}
      </div>

      <div>
        <label htmlFor="content">Content</label>
        <textarea id="content" name="content" />
        {actionData?.errors?.content && (
          <p className="text-red-500">{actionData.errors.content}</p>
        )}
      </div>

      <button type="submit">Create Post</button>
    </Form>
  );
}
```

### Server Errors

Juniper automatically logs all errors, so you don't need to catch and log them
yourself. The main reason to catch errors is to provide a user-friendly
`exposedMessage`. For server errors (status >= 500), without an
`exposedMessage`, users will only see the default status message (e.g.,
"Internal Server Error"):

```typescript
// routes/dashboard.ts
import { HttpError } from "@udibo/juniper";
import type { RouteLoaderArgs } from "@udibo/juniper";

export async function loader({ context }: RouteLoaderArgs) {
  try {
    const data = await fetchDashboardData();
    return { data };
  } catch (cause) {
    // Convert to HttpError (preserves if already HttpError)
    const error = HttpError.from(cause);
    // Set a user-friendly message for the client
    error.exposedMessage = "Failed to load dashboard data";
    throw error;
  }
}
```

You can also set `exposedMessage` in the constructor:

```typescript
throw new HttpError(500, "Internal error details", {
  exposedMessage: "Failed to load dashboard data",
  cause: originalError,
});
```

### Error Handling in Middleware

Middleware errors are caught by error boundaries. See
[Middleware](middleware.md) for more details:

```typescript
// routes/admin/main.ts
import { HttpError } from "@udibo/juniper";
import type { MiddlewareFunction } from "@udibo/juniper";
import { redirect } from "react-router";

const authMiddleware: MiddlewareFunction = async ({ context }, next) => {
  const user = context.get(userContext);

  if (!user) {
    throw redirect("/login");
  }

  if (!user.isAdmin) {
    throw new HttpError(403, "Admin access required");
  }

  await next();
};

export const middleware = [authMiddleware];
```

### Nested Error Boundaries

Child error boundaries catch errors before parent boundaries:

```
routes/
├── main.tsx           # Catches all uncaught errors
├── blog/
│   ├── main.tsx       # Catches blog section errors
│   └── [id]/
│       └── index.tsx  # Catches individual post errors
```

If the `[id]/index.tsx` error boundary isn't defined or doesn't handle an error,
it bubbles up to `blog/main.tsx`, then to `main.tsx`.

```tsx
// routes/blog/main.tsx
export function ErrorBoundary(
  { error, resetErrorBoundary }: ErrorBoundaryProps,
) {
  return (
    <div>
      <h1>Blog Error</h1>
      <p>Something went wrong in the blog section.</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}
```

## Next Steps

**Next:** [Styling](styling.md) - CSS and TailwindCSS integration

**Related topics:**

- [Logging](logging.md) - Logging and OpenTelemetry
- [Testing](testing.md) - Testing utilities and patterns
- [Middleware](middleware.md) - Server and client middleware
