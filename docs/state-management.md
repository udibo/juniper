# State Management

## Overview

Juniper offers three distinct approaches for managing state, each serving
different purposes:

| Approach                 | Scope                                         | Transfer to browser                       | Use case                         |
| ------------------------ | --------------------------------------------- | ----------------------------------------- | -------------------------------- |
| **Hono Variables**       | One server request                            | None                                      | Server-only request data         |
| **React Router Context** | One server request or browser router lifetime | Registered values in initial hydration    | Loader/action/middleware context |
| **React Context**        | Mounted component subtree, including SSR      | Supply matching initial values explicitly | Shared component state           |

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

export async function loader({ context }: RouteLoaderArgs) {
  const user = context.get(userContext);

  if (!user) {
    throw new HttpError(401, "Authentication required");
  }

  return { user, dashboardData: await fetchDashboard(user.id) };
}
```

### Sharing Server Context with the Client

For context values to be available on the client after hydration, register them
using `registerContext`. This handles serialization and deserialization for the
initial document; it is not an automatic synchronization channel for every later
server-side context change. Register only values the browser may receive. Use a
serializer that selects public fields rather than sending a complete database
user record, tokens, or credentials.

Import the registration module from the root `.tsx` route before hydration, as
well as wherever server middleware needs its context key. Importing it only from
a lazy child can leave its decoder unavailable when the document's context is
deserialized.

**Define and register context:**

```typescript
// context/user.ts
import { createContext } from "react-router";
import { registerContext } from "@udibo/juniper";

export interface User {
  id: string;
  name: string;
  role: "admin" | "user";
}

export const userContext = createContext<User | null>();

// Register for automatic serialization to client
registerContext<User | null>({
  name: "user",
  context: userContext,
  serialize: (user) => user,
  deserialize: (data) => data ?? null,
});
```

**Set context in middleware:**

```typescript
// routes/main.ts
import { Hono } from "hono";
import type { AppEnv } from "@udibo/juniper/server";
import { userContext } from "@/context/user.ts";

const app = new Hono<AppEnv>();

app.use(async (c, next) => {
  const context = c.get("context");
  const user = await getUser(c.req);
  context.set(userContext, user);
  await next();
});

export default app;
```

**Access in loaders and actions:**

```typescript
// routes/dashboard/index.ts
import { HttpError } from "@udibo/juniper";
import type { RouteLoaderArgs } from "@udibo/juniper";
import { userContext } from "@/context/user.ts";

export async function loader({ context }: RouteLoaderArgs) {
  const user = context.get(userContext);

  if (!user) {
    throw new HttpError(401, "Authentication required");
  }

  return { user, dashboardData: await fetchDashboard(user.id) };
}
```

**Access in components:**

Components receive the `context` prop, but note that **context changes do not
trigger re-renders**. The primary use case for accessing context in components
is to pass values to React providers, enabling loaders, actions, and components
to share state through libraries like TanStack Query. See the
[TanStack Query example](#tanstack-query) for this pattern.

```tsx
// routes/main.tsx
import { Outlet } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import type { RouteProps } from "@udibo/juniper";
import { queryClientContext } from "@/context/query.ts";

export default function Main({ context }: RouteProps) {
  // Pass context value to a provider for shared state
  const queryClient = context.get(queryClientContext);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
```

The `registerContext` function accepts:

| Property      | Description                                               |
| ------------- | --------------------------------------------------------- |
| `name`        | Unique identifier for the context (used in serialization) |
| `context`     | The React Router context created with `createContext()`   |
| `serialize`   | Converts the value to a serializable format               |
| `deserialize` | Reconstructs the value on the client                      |

### Serializable Values

Use plain objects, arrays, and JSON primitives for transferred data. Juniper
also handles `undefined`, `Date`, and `Error`, and accepts promise values in
loader/action data. See [error handling](error-handling.md#error-serialization)
for the distinction between thrown errors, returned error data, and custom error
serializers.

`bigint` values are accepted, but the underlying numeric encoding can change
their JavaScript type: `123n` decodes as the number `123`, while integers beyond
the safe-number range remain `bigint`. Send a decimal string or register a
wrapper type if the consumer requires an exact `bigint` contract.

`Map`, `Set`, `RegExp`, and `URL` are **not** built-in round-trip types. Without
registration, objects are reduced to their enumerable own properties; typical
instances of these classes become empty objects. Convert them to plain data or
register a representation before returning them. Do the same for other classes
whose identity or non-enumerable state matters.

For example, register a URL as its complete string representation:

```typescript
// serialization/url.ts
import { registerType } from "@udibo/juniper";

registerType<URL, string>({
  name: "URL",
  is: (value): value is URL => value instanceof URL,
  serialize: (url) => url.href,
  deserialize: (href) => new URL(href),
});
```

Import the registration from the root client module so it executes on both
server and browser before hydration data is decoded:

```tsx
// routes/main.tsx
import "@/serialization/url.ts";
```

The route can then return a URL instance in loader data. Give each registration
a unique name and import the module wherever standalone server code needs it.
Use synchronous serializers that return plain data: JSON values plus
`undefined`, `Date`, `bigint`, and non-finite numbers. Do not return promises or
other instances (`Map`, `Set`, `URL`, class instances) from a serializer; its
output is not processed recursively, and the first document load reduces such
instances to their enumerable own properties.

#### How Values Travel

The first document load embeds the page's data in an inline script as JSON text
(hydration payload version 3). Values JSON cannot express are written as tagged
objects of the form `{"$t": tag, "v": value}`: `Date`, `undefined`, `NaN`,
`Infinity`, `-Infinity`, `-0`, `bigint` values outside the safe-number range,
errors, settled promises, and registered types. A plain object that has its own
`$t` or `__proto__` key is written in an escaped form, so data can never be
mistaken for a tag. Every `<`, U+2028, and U+2029 in the payload is written as a
`\u` escape, so no string in loader data can close the script element or start
an HTML comment.

Client navigations and fetchers request data as CBOR (`application/cbor`, or
`application/cbor-stream` when deferred promises are still pending). Both paths
decode to the same values, including the `bigint` normalization described above,
so a loader's data has the same types whether it arrived with the document or on
a later navigation.

A document rendered by an earlier Juniper release carries hydration payload
version 2 (base64-encoded CBOR). The browser client still decodes it, so a page
restored from cache after an upgrade hydrates with the new client bundle.

## React Context

React Context provides values to a component subtree during both SSR and browser
rendering. It is separate from Juniper's request context and is not
automatically serialized. Pass shared initial values from loader data or a
registered request context, and keep the server render and the browser's first
render consistent.

### When to Use React Context

Use React Context for:

- UI state (modals, sidebars, themes)
- Client-side caching
- Form state across components
- Animation state
- Shared component state, with matching initial values when it affects SSR

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

React Router loads newly matched routes and revalidates data when navigation or
a mutation requires it. Unchanged parent layouts are not necessarily reloaded.
Returning to a previously visited detail route can run its loader again; Juniper
does not provide a persistent result cache for those visits. Add an application
cache when you need reuse or background refresh, and invalidate it after
mutations and changes of user or tenant.

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

**Create and register the context:**

```typescript
// context/query.ts
import { createContext } from "react-router";
import {
  dehydrate,
  hydrate as hydrateQueryClient,
  QueryClient,
} from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";
import { registerContext } from "@udibo/juniper";

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

// Register for automatic serialization
registerContext<QueryClient, DehydratedState | undefined>({
  name: "queryClient",
  context: queryClientContext,
  serialize: (queryClient) => dehydrate(queryClient),
  deserialize: (dehydratedState) => {
    const queryClient = createQueryClient();
    if (dehydratedState) {
      hydrateQueryClient(queryClient, dehydratedState);
    }
    return queryClient;
  },
});
```

**Initialize in server middleware:**

```typescript
// routes/main.ts
import { Hono } from "hono";
import type { AppEnv } from "@udibo/juniper/server";
import { createQueryClient, queryClientContext } from "@/context/query.ts";

const app = new Hono<AppEnv>();

app.use(async (c, next) => {
  const context = c.get("context");
  const queryClient = createQueryClient();
  context.set(queryClientContext, queryClient);
  await next();
});

export default app;
```

**Use in components:**

```tsx
// routes/main.tsx
import { Outlet } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import type { RouteProps } from "@udibo/juniper";
import { queryClientContext } from "@/context/query.ts";

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

| Feature                      | Hono Variables               | Router Context                | React Context                            |
| ---------------------------- | ---------------------------- | ----------------------------- | ---------------------------------------- |
| **Available on server**      | Yes                          | Yes                           | Yes, within the rendered provider        |
| **Available on client**      | No                           | Yes (if serialized)           | Yes                                      |
| **Persists across requests** | No                           | No                            | While its browser provider stays mounted |
| **Type-safe**                | Yes (with generics)          | Yes (with createContext)      | Yes (with createContext)                 |
| **Serialization needed**     | N/A                          | For server-to-client transfer | Pass matching initial values explicitly  |
| **Good for**                 | Request data, DB connections | User sessions, app config     | UI state, client features                |

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

For a browser-stored preference, initialize state consistently and read storage
in an effect after hydration. A provider can use this hook in place of
`useState`:

```tsx
// hooks/useStoredTheme.ts
import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type Theme = "light" | "dark";

export function useStoredTheme(
  initialTheme: Theme = "light",
): [Theme, Dispatch<SetStateAction<Theme>>] {
  const state = useState<Theme>(initialTheme);
  const [, setTheme] = state;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      return;
    }
  }, []);

  return state;
}
```

If the preference must affect the first paint, read a cookie on the server and
pass that value as `initialTheme` through loader data. Reading `localStorage`
during render either fails on the server or makes the first browser render
disagree with SSR.

**Avoid:**

- Registering sensitive request context for transfer to the browser
- Using Hono Variables for data needed in components (won't be available)
- Initializing a React provider differently on the server and during hydration

## Next Steps

**Next:** [Error Handling](error-handling.md) - Error boundaries and HttpError

**Related topics:**

- [Middleware](middleware.md) - Server and client middleware
- [Routing](routing.md) - File-based routing and data loading
- [Database](database.md) - Deno KV and PostgreSQL
