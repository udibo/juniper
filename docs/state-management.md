# State Management

## Overview

Juniper offers three distinct approaches for managing state, each serving
different purposes:

| Approach                 | Scope               | Serialization  | Use Case                          |
| ------------------------ | ------------------- | -------------- | --------------------------------- |
| **Hono Variables**       | Server request only | Not serialized | Request-scoped server data        |
| **React Router Context** | Server to client    | Serialized     | Shared app state (user, settings) |
| **React Context**        | Client only         | Not applicable | UI state, client-side data        |

## Hono Variables (Server)

Hono variables are request-scoped values stored on the Hono context (`c`). They
exist only during server-side request processing and are **not** transferred to
the client.

### Setting Variables

Set variables in Hono middleware using `c.set()`:

```typescript
// routes/main.ts
import { Hono } from "hono";
import type { AppEnv } from "@udibo/juniper/server";

// Extend the Hono environment for type safety
interface CustomEnv extends AppEnv {
  Variables: {
    requestId: string;
    dbConnection: DatabaseConnection;
  };
}

const app = new Hono<CustomEnv>();

app.use(async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  c.set("dbConnection", await getDbConnection());

  await next();

  // Clean up after request
  c.get("dbConnection").close();
});

export default app;
```

### Accessing Variables

Access variables in subsequent middleware or Hono route handlers:

```typescript
app.use(async (c, next) => {
  const requestId = c.get("requestId");
  console.log(`Processing request: ${requestId}`);
  await next();
});

// In a Hono route handler (API endpoints)
app.get("/api/data", (c) => {
  const db = c.get("dbConnection");
  const data = await db.query("SELECT * FROM items");
  return c.json(data);
});
```

### Variable Typing

Use TypeScript generics for type safety:

```typescript
interface AppEnv extends AppEnv {
  Variables: {
    requestId: string;
    startTime: number;
  };
}

const app = new Hono<AppEnv>();

app.use(async (c, next) => {
  c.set("requestId", crypto.randomUUID()); // Type-checked
  c.set("startTime", Date.now()); // Type-checked
  await next();
});
```

## React Router Context

React Router Context is the primary way to share state between server
middleware, loaders, actions, and React components. Values can be serialized and
transferred from server to client during hydration.

### Creating Context

Create context using `createContext` from `react-router`:

```typescript
// context/user.ts
import { createContext } from "react-router";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

export const userContext = createContext<User | null>();

// For values that should always exist
export const configContext = createContext<AppConfig>();
```

### Setting Context in Middleware

Set context values in Hono middleware:

```typescript
// routes/main.ts
import { Hono } from "hono";
import type { AppEnv } from "@udibo/juniper/server";
import { userContext } from "@/context/user.ts";

const app = new Hono<AppEnv>();

app.use(async (c, next) => {
  const context = c.get("context"); // RouterContextProvider

  const token = c.req.header("Authorization");
  const user = token ? await verifyToken(token) : null;

  context.set(userContext, user);
  await next();
});

export default app;
```

### Using Context in Components

Access context in React components via the `context` prop:

```tsx
// routes/profile/index.tsx
import type { RouteProps } from "@udibo/juniper";
import { userContext } from "@/context/user.ts";

export default function Profile({ context }: RouteProps) {
  const user = context.get(userContext);

  if (!user) {
    return <p>Please log in to view your profile.</p>;
  }

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
    </div>
  );
}
```

Access in loaders:

```typescript
// routes/dashboard/index.ts
import { HttpError } from "@udibo/juniper";
import type { RouteLoaderArgs } from "@udibo/juniper";
import { userContext } from "@/context/user.ts";

export function loader({ context }: RouteLoaderArgs) {
  const user = context.get(userContext);

  if (!user) {
    throw new HttpError(401, "Authentication required");
  }

  return { user, dashboardData: await fetchDashboard(user.id) };
}
```

### Sharing Server Context with the Client

For context values to be available on the client after hydration, you need to
serialize them on the server and deserialize them on the client. These functions
are only supported in your **root route files** (`routes/main.ts` and
`routes/main.tsx`).

**Server route** - Export `serializeContext` to extract context values:

```typescript
// routes/main.ts
import { Hono } from "hono";
import type { RouterContextProvider } from "react-router";
import type { AppEnv } from "@udibo/juniper/server";
import { userContext } from "@/context/user.ts";
import type { SerializedContext } from "./main.tsx";

const app = new Hono<AppEnv>();

app.use(async (c, next) => {
  const context = c.get("context");
  const user = await getUser(c.req);
  context.set(userContext, user);
  await next();
});

// Serialize context for client hydration
export function serializeContext(
  context: RouterContextProvider,
): SerializedContext {
  return {
    user: context.get(userContext),
  };
}

export default app;
```

**Client route** - Define `SerializedContext` type and export
`deserializeContext`:

```tsx
// routes/main.tsx
import { Outlet, RouterContextProvider } from "react-router";
import type { User } from "@/context/user.ts";
import { userContext } from "@/context/user.ts";

// Define the shape of serialized context
export interface SerializedContext {
  user: User | null;
}

// Deserialize context on the client
export function deserializeContext(
  serialized: SerializedContext | undefined,
): RouterContextProvider {
  const context = new RouterContextProvider();
  if (serialized?.user) {
    context.set(userContext, serialized.user);
  }
  return context;
}

export default function Main() {
  return (
    <main>
      <Outlet />
    </main>
  );
}
```

**Important:** Define the `SerializedContext` type in the client route (`.tsx`)
to avoid importing server-only code into client bundles. The server route
imports this type for type safety.

**Supported types:** Juniper's serialization (used for context, loader data,
action data, and errors) supports all standard JSON types plus: `undefined`,
`bigint`, `Date`, `RegExp`, `Set`, `Map`, `Error`, and `URL`. Loaders and
actions can also return `Promise` values.

## React Context

Standard React Context is for client-side state that doesn't need to be shared
with the server.

### When to Use React Context

Use React Context for:

- UI state (modals, sidebars, themes)
- Client-side caching
- Form state across components
- Animation state
- Any state that only matters on the client

### Creating React Context

```tsx
// context/ThemeContext.tsx
import { createContext, type ReactNode, useContext, useState } from "react";

interface ThemeContextValue {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggleTheme = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
```

### Provider Patterns

Wrap your app with providers in the root layout:

```tsx
// routes/main.tsx
import { Outlet } from "react-router";
import { ThemeProvider } from "@/context/ThemeContext.tsx";
import { ToastProvider } from "@/context/ToastContext.tsx";

export default function Main() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <main>
          <Outlet />
        </main>
      </ToastProvider>
    </ThemeProvider>
  );
}
```

Use context in components:

```tsx
import { useTheme } from "@/context/ThemeContext.tsx";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      Current: {theme} (click to toggle)
    </button>
  );
}
```

## Caching

React Router's loaders fetch fresh data on every route navigation. This means
navigating from Contact 1 to Contact 2 and back to Contact 1 causes two separate
server requests for Contact 1, even though the data was just fetched. For many
applications, this behavior is fine. However, if you need caching, background
refetching, or stale-while-revalidate patterns, you can integrate a caching
library with Juniper.

Popular caching solutions that work well with Juniper include:

- **TanStack Query** (formerly React Query) - Full-featured data fetching and
  caching library
- **SWR** - Lightweight stale-while-revalidate library from Vercel
- **Apollo Client** - For GraphQL APIs with built-in caching

### TanStack Query

TanStack Query (formerly known as React Query) provides intelligent caching for
server data. While React Router handles **when** to fetch data (at route
transitions), TanStack Query handles **what** to do with fetched data, including
caching, background refetching, and optimistic updates.

#### Setting Up QueryClient

Share the QueryClient via React Router context so it's accessible in loaders,
actions, and components.

**Create the context:**

```typescript
// context/query.ts
import { createContext } from "react-router";
import { QueryClient } from "@tanstack/react-query";

export const queryClientContext = createContext<QueryClient>();

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // Data is fresh for 1 minute
      },
    },
  });
}
```

**Initialize in server middleware:**

```typescript
// routes/main.ts
import { Hono } from "hono";
import { dehydrate } from "@tanstack/react-query";
import type { RouterContextProvider } from "react-router";
import type { AppEnv } from "@udibo/juniper/server";
import { createQueryClient, queryClientContext } from "@/context/query.ts";
import type { SerializedContext } from "./main.tsx";

const app = new Hono<AppEnv>();

app.use(async (c, next) => {
  const context = c.get("context");
  const queryClient = createQueryClient();
  context.set(queryClientContext, queryClient);
  await next();
});

export function serializeContext(
  context: RouterContextProvider,
): SerializedContext {
  const serializedContext: SerializedContext = {};
  try {
    const queryClient = context.get(queryClientContext);
    serializedContext.dehydratedState = dehydrate(queryClient);
  } catch {
    // queryClient not set
  }
  return serializedContext;
}

export default app;
```

**Hydrate on the client:**

```tsx
// routes/main.tsx
import { Outlet, RouterContextProvider } from "react-router";
import {
  hydrate as hydrateQueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";
import type { RouteProps } from "@udibo/juniper";
import { createQueryClient, queryClientContext } from "@/context/query.ts";

export interface SerializedContext {
  dehydratedState?: DehydratedState;
}

export function deserializeContext(
  serialized?: SerializedContext,
): RouterContextProvider {
  const context = new RouterContextProvider();
  const queryClient = createQueryClient();
  if (serialized?.dehydratedState) {
    hydrateQueryClient(queryClient, serialized.dehydratedState);
  }
  context.set(queryClientContext, queryClient);
  return context;
}

export default function Main({ context }: RouteProps) {
  const queryClient = context.get(queryClientContext);
  return (
    <QueryClientProvider client={queryClient}>
      <main>
        <Outlet />
      </main>
    </QueryClientProvider>
  );
}
```

#### Defining Query Options

Define query options in client route files so they're available for both loaders
and components:

```tsx
// routes/contacts/index.tsx
import { HttpError } from "@udibo/juniper";
import type { Contact } from "@/services/contact.ts";

export const contactsQuery = () => ({
  queryKey: ["contacts"],
  queryFn: async () => {
    const response = await fetch("/api/contacts");
    if (!response.ok) {
      throw await HttpError.from(response);
    }
    return response.json() as Promise<Contact[]>;
  },
});

export const contactQuery = (id: string) => ({
  queryKey: ["contact", id],
  queryFn: async () => {
    const response = await fetch(`/api/contacts/${id}`);
    if (!response.ok) {
      throw await HttpError.from(response);
    }
    return response.json() as Promise<Contact>;
  },
});
```

#### Using ensureQueryData in Loaders

Use `ensureQueryData` in loaders to populate the cache. On the server, call the
service directly; on the client, use `serverLoader()` to fetch from the server
API:

**Server loader** - Direct service call:

```typescript
// routes/contacts/index.ts
import type { RouteLoaderArgs } from "@udibo/juniper";
import { queryClientContext } from "@/context/query.ts";
import { getContacts } from "@/services/contact.ts";
import { type ContactsLoaderData, contactsQuery } from "./index.tsx";

export async function loader(
  { context }: RouteLoaderArgs,
): Promise<ContactsLoaderData> {
  const queryClient = context.get(queryClientContext);
  return await queryClient.ensureQueryData({
    ...contactsQuery(),
    queryFn: () => getContacts(), // Direct server call
  });
}
```

**Client loader** - Uses serverLoader:

```tsx
// routes/contacts/index.tsx
import type { AnyParams, RouteLoaderArgs, RouteProps } from "@udibo/juniper";
import { queryClientContext } from "@/context/query.ts";
import type { Contact } from "@/services/contact.ts";

export type ContactsLoaderData = Contact[];

export async function loader(
  { context, serverLoader }: RouteLoaderArgs<AnyParams, ContactsLoaderData>,
): Promise<ContactsLoaderData> {
  const queryClient = context.get(queryClientContext);
  return await queryClient.ensureQueryData({
    ...contactsQuery(),
    queryFn: () => serverLoader(), // Calls server loader via API
  });
}
```

#### Using useQuery in Components

Use `useQuery` with `initialData` from the loader to leverage caching benefits:

```tsx
// routes/contacts/index.tsx
import { useQuery } from "@tanstack/react-query";
import type { AnyParams, RouteProps } from "@udibo/juniper";
import type { Contact } from "@/services/contact.ts";

export default function ContactsIndex({
  loaderData,
}: RouteProps<AnyParams, Contact[]>) {
  const { data: contacts } = useQuery({
    ...contactsQuery(),
    initialData: loaderData,
  });

  return (
    <ul>
      {contacts.map((contact) => (
        <li key={contact.id}>
          {contact.firstName} {contact.lastName}
        </li>
      ))}
    </ul>
  );
}
```

#### Invalidating Queries After Mutations

In client actions, invalidate or remove related queries after mutations:

```tsx
// routes/contacts/[id]/index.tsx
import type { RouteActionArgs } from "@udibo/juniper";
import { queryClientContext } from "@/context/query.ts";
import { contactsQuery } from "../index.tsx";
import { contactQuery } from "./index.tsx";

export async function action(
  { context, params, serverAction }: RouteActionArgs<{ id: string }, void>,
): Promise<void> {
  const queryClient = context.get(queryClientContext);
  try {
    await serverAction();
  } finally {
    // Invalidate contacts list so it refetches
    queryClient.invalidateQueries(contactsQuery());
    // Remove this contact from cache (it was deleted)
    queryClient.removeQueries(contactQuery(params.id));
  }
}
```

For updates (not deletions), invalidate rather than remove:

```tsx
// routes/contacts/[id]/edit.tsx
export async function action(
  { context, params, serverAction }: RouteActionArgs<{ id: string }, void>,
): Promise<void> {
  const queryClient = context.get(queryClientContext);
  try {
    await serverAction();
  } finally {
    queryClient.invalidateQueries(contactsQuery());
    queryClient.invalidateQueries(contactQuery(params.id));
  }
}
```

#### Using useMutation

For client-side mutations without server actions, use `useMutation`:

```tsx
// routes/contacts/new.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { HttpError } from "@udibo/juniper";
import type { Contact, NewContact } from "@/services/contact.ts";

export default function NewContact() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: NewContact) => {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw await HttpError.from(response);
      }
      return response.json() as Promise<Contact>;
    },
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      navigate(`/contacts/${contact.id}`);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    createMutation.mutate({
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="firstName" required />
      <input type="text" name="lastName" required />
      <input type="email" name="email" required />
      <button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Creating..." : "Create Contact"}
      </button>
      {createMutation.isError && <p>Error: {createMutation.error.message}</p>}
    </form>
  );
}
```

#### When to Use TanStack Query

Use TanStack Query when you need:

- **Caching** - Avoid refetching data that hasn't changed
- **Background refetching** - Keep data fresh without blocking UI
- **Stale-while-revalidate** - Show cached data while fetching fresh data
- **Optimistic updates** - Update UI before server confirms
- **Request deduplication** - Multiple components requesting same data

For simple applications without these needs, React Router's loaders alone may be
sufficient.

## Comparing Approaches

### Hono Variables vs Router Context vs React Context

| Feature                      | Hono Variables               | Router Context            | React Context                  |
| ---------------------------- | ---------------------------- | ------------------------- | ------------------------------ |
| **Available on server**      | Yes                          | Yes                       | No (SSR renders initial state) |
| **Available on client**      | No                           | Yes (if serialized)       | Yes                            |
| **Persists across requests** | No                           | No                        | Yes (client session)           |
| **Type-safe**                | Yes (with generics)          | Yes (with createContext)  | Yes (with createContext)       |
| **Serialization needed**     | N/A                          | Yes                       | N/A                            |
| **Good for**                 | Request data, DB connections | User sessions, app config | UI state, client features      |

### Best Practices

**Use Hono Variables for:**

- Database connections (should not be serialized)
- Request-specific data (request ID, timing)
- Server-only secrets and credentials
- Middleware-to-middleware communication

```typescript
// Good: Database connection in Hono variable
app.use(async (c, next) => {
  c.set("db", await pool.getConnection());
  await next();
  c.get("db").release();
});
```

**Use Router Context for:**

- User authentication state
- Feature flags that affect rendering
- Application configuration
- Data that loaders and components both need

```typescript
// Good: User in Router Context (serialized to client)
app.use(async (c, next) => {
  const context = c.get("context");
  context.set(userContext, await getUser(c.req));
  await next();
});
```

**Use React Context for:**

- UI state (theme, sidebar open/closed)
- Toast/notification systems
- Modal state
- Client-side caches

```tsx
// Good: Theme in React Context (client-only)
const [theme, setTheme] = useState(
  localStorage.getItem("theme") || "light",
);
```

**Avoid:**

- Storing sensitive data in Router Context (it's serialized to HTML)
- Using Hono Variables for data needed in components (won't be available)
- Using React Context for data that affects SSR (causes hydration mismatches)

## Next Steps

**Next:** [Error Handling](error-handling.md) - Error boundaries and HttpError

**Related topics:**

- [Middleware](middleware.md) - Server and client middleware
- [Routing](routing.md) - File-based routing and data loading
- [Database](database.md) - Deno KV and other databases
