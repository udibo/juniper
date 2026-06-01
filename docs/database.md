# Database

## Overview

Juniper doesn't prescribe a specific database solution, giving you the
flexibility to choose what works best for your project. This guide covers Deno
KV (built into Deno) and PostgreSQL (with Drizzle ORM and Zod), followed by
general data-access patterns. Juniper works with any database that has a
Deno-compatible driver.

## Deno KV

Deno KV is a key-value database built directly into Deno, requiring no external
services for development. It provides a simple yet powerful API for storing and
retrieving data.

### Setup

Open a KV database connection:

```typescript
// services/db.ts
let kv: Deno.Kv | undefined;

export async function getKv(): Promise<Deno.Kv> {
  if (!kv) {
    kv = await Deno.openKv();
  }
  return kv;
}

export function closeKv(): void {
  kv?.close();
  kv = undefined;
}
```

For testing, use an in-memory database:

```typescript
import { isTest } from "@udibo/juniper/utils/env";

export async function getKv(): Promise<Deno.Kv> {
  if (!kv) {
    kv = await (isTest() ? Deno.openKv(":memory:") : Deno.openKv());
  }
  return kv;
}
```

### Basic Operations

**Setting and Getting Values:**

```typescript
const kv = await getKv();

// Set a value
await kv.set(["users", "user-123"], {
  id: "user-123",
  name: "Alice",
  email: "alice@example.com",
});

// Get a value
const entry = await kv.get(["users", "user-123"]);
if (entry.value) {
  console.log(entry.value.name); // "Alice"
}

// Delete a value
await kv.delete(["users", "user-123"]);
```

**Listing Values:**

```typescript
const kv = await getKv();

// List all users
const entries = kv.list({ prefix: ["users"] });
const users = [];
for await (const entry of entries) {
  users.push(entry.value);
}

// List with options
const recentEntries = kv.list(
  { prefix: ["users"] },
  { limit: 10, reverse: true },
);
```

**Keys and Indexing:**

Use structured keys for efficient querying:

```typescript
// Primary key by ID
await kv.set(["users", "id", user.id], user);

// Secondary index by email (for unique lookups)
await kv.set(["users", "email", user.email], user);

// Secondary index for non-unique values (include ID in key)
await kv.set(["posts", "authorId", post.authorId, post.id], post);
```

### Transactions

Use atomic operations to ensure data consistency:

```typescript
const kv = await getKv();

// Atomic transaction with optimistic locking
const existing = await kv.get(["users", "id", userId]);
if (!existing.value) {
  throw new Error("User not found");
}

const result = await kv.atomic()
  // Check that the value hasn't changed
  .check(existing)
  // Update the primary entry
  .set(["users", "id", userId], updatedUser)
  // Update secondary indexes
  .set(["users", "email", updatedUser.email], updatedUser)
  // Delete old secondary index if email changed
  .delete(["users", "email", existing.value.email])
  .commit();

if (!result.ok) {
  throw new Error("Transaction failed - data was modified");
}
```

**Creating with Unique Constraints:**

```typescript
async function createUser(user: User): Promise<User> {
  const kv = await getKv();

  const result = await kv.atomic()
    // Ensure email doesn't already exist
    .check({ key: ["users", "email", user.email], versionstamp: null })
    // Ensure username doesn't already exist
    .check({ key: ["users", "username", user.username], versionstamp: null })
    // Set primary and secondary entries
    .set(["users", "id", user.id], user)
    .set(["users", "email", user.email], user)
    .set(["users", "username", user.username], user)
    .commit();

  if (!result.ok) {
    throw new HttpError(400, "User with this email or username already exists");
  }

  return user;
}
```

## PostgreSQL

For relational data, pair Juniper with [PostgreSQL](https://www.postgresql.org/)
using [Drizzle ORM](https://orm.drizzle.team/) — a typed query builder with a
migration toolkit — and the `pg` (node-postgres) driver. Validate untrusted
input with [Zod](https://zod.dev/).

> A complete, runnable version of everything in this section ships as the
> **`postgres` template**
> ([templates/postgres](https://github.com/udibo/juniper/tree/main/templates/postgres)).
> It implements a small guestbook so you can see the full read/write loop. Clone
> it with `deno run -A npm:degit udibo/juniper/templates/postgres my-app`.

### Dependencies

Add the database packages to your import map:

```json
{
  "imports": {
    "drizzle-kit": "npm:drizzle-kit@^0.31.10",
    "drizzle-orm": "npm:drizzle-orm@^0.45.2",
    "pg": "npm:pg@^8.20.0",
    "@types/pg": "npm:@types/pg@^8.20.0",
    "zod": "npm:zod@^4.3.6"
  }
}
```

### Running PostgreSQL Locally

Use Docker Compose to run PostgreSQL for development and tests. Create a
`docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:18
    container_name: juniper-postgres
    ports:
      - "5432:5432"
    volumes:
      - ./docker/volumes/postgres:/var/lib/postgresql
      - ./docker/postgres/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped
```

The mounted `docker/postgres/init-db.sql` creates the dev and test databases the
first time the container starts:

```sql
CREATE DATABASE app_dev;
CREATE DATABASE app_test;
```

Point each environment at its own database. In `.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_dev
```

And in `.env.test`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_test
```

### Schema

Define your tables with Drizzle. Columns are written in camelCase and mapped to
snake_case in PostgreSQL by the `casing: "snake_case"` option (so `createdAt`
becomes the `created_at` column):

```typescript
// db/schema.ts
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: serial().primaryKey(),
  name: text().notNull(),
  body: text().notNull(),
  createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
});
```

### Connection

Create the Drizzle client from a `node-postgres` connection pool. The pool opens
no connection until the first query runs, so importing this module is cheap:

```typescript
// db/mod.ts
import { getEnv } from "@udibo/juniper/utils/env";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema.ts";

export const db = drizzle({
  connection: getEnv("DATABASE_URL")!,
  casing: "snake_case",
  schema,
});

let closed = false;

/** Closes the pool. Call in a test's `afterAll` to release resources. */
export async function closeDb(): Promise<void> {
  if (closed) return;
  closed = true;
  await db.$client.end();
}
```

### Migrations

Configure Drizzle Kit with `drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: Deno.env.get("DATABASE_URL")!,
  },
  casing: "snake_case",
});
```

Add tasks for Docker and Drizzle Kit to `deno.json`:

```json
{
  "tasks": {
    "docker:start": "docker compose up -d --wait",
    "docker:stop": "docker compose down",
    "db:generate": "deno run -A --env-file npm:drizzle-kit generate",
    "db:migrate:dev": "deno run -A --env-file npm:drizzle-kit migrate",
    "db:migrate:test": "deno run -A --env-file --env-file=.env.test npm:drizzle-kit migrate",
    "db:migrate": { "dependencies": ["db:migrate:dev", "db:migrate:test"] },
    "db:studio": "deno run -A --env-file npm:drizzle-kit studio"
  }
}
```

The workflow for a schema change is: edit `db/schema.ts`, generate a migration,
then apply it.

```bash
deno task docker:start   # Start PostgreSQL
deno task db:generate    # Generate SQL from schema changes
deno task db:migrate     # Apply migrations to the dev and test databases
```

### Service Layer

Keep queries in a service module of plain exported functions, and validate
untrusted input with Zod. Deriving the row type from the schema with
`$inferSelect` keeps the type in sync with the table:

```typescript
// services/message.ts
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/mod.ts";
import { messages } from "@/db/schema.ts";

export type Message = typeof messages.$inferSelect;

export const newMessageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  body: z.string().trim().min(1, "Message is required").max(1000),
});

export type NewMessage = z.infer<typeof newMessageSchema>;

export async function listMessages(): Promise<Message[]> {
  return await db.select().from(messages).orderBy(desc(messages.createdAt));
}

export async function createMessage(data: NewMessage): Promise<Message> {
  const [message] = await db.insert(messages).values(data).returning();
  return message;
}

export async function deleteMessage(id: number): Promise<boolean> {
  const deleted = await db.delete(messages).where(eq(messages.id, id))
    .returning({ id: messages.id });
  return deleted.length > 0;
}
```

### Using the Database in Routes

Because the service imports the connection (and therefore the `pg` driver), only
call it from **server-only** route files (`.ts`). A `.ts` loader/action never
ships to the browser, so your database code and credentials stay on the server.
The matching `.tsx` file imports only the **types**, which are erased at build
time.

```ts
// routes/index.ts — server loader + action
import { redirect } from "react-router";

import type {
  AnyParams,
  RouteActionArgs,
  RouteLoaderArgs,
} from "@udibo/juniper";

import {
  createMessage,
  deleteMessage,
  listMessages,
  newMessageSchema,
} from "@/services/message.ts";

import type { GuestbookActionData, GuestbookLoaderData } from "./index.tsx";

export async function loader(
  _args: RouteLoaderArgs<AnyParams, GuestbookLoaderData>,
): Promise<GuestbookLoaderData> {
  return { messages: await listMessages() };
}

export async function action(
  { request }: RouteActionArgs<AnyParams, GuestbookActionData>,
): Promise<GuestbookActionData> {
  const formData = await request.formData();

  if (formData.get("intent") === "delete") {
    const id = Number(formData.get("id"));
    if (Number.isInteger(id)) await deleteMessage(id);
    throw redirect("/");
  }

  const result = newMessageSchema.safeParse({
    name: formData.get("name") ?? "",
    body: formData.get("body") ?? "",
  });
  if (!result.success) {
    const errors: NonNullable<GuestbookActionData["errors"]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if ((field === "name" || field === "body") && !errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { errors };
  }

  await createMessage(result.data);
  throw redirect("/");
}
```

The component (`.tsx`) receives the data through props and imports only the
`Message` type from the service:

```tsx
// routes/index.tsx
import { Form } from "react-router";

import type { AnyParams, RouteProps } from "@udibo/juniper";

import type { Message } from "@/services/message.ts";

export interface GuestbookLoaderData {
  messages: Message[];
}

export interface GuestbookActionData {
  errors?: { name?: string; body?: string };
}

export default function Guestbook(
  { loaderData, actionData }: RouteProps<
    AnyParams,
    GuestbookLoaderData,
    GuestbookActionData
  >,
) {
  return (
    <>
      <Form method="post">
        <input type="text" name="name" maxLength={100} required />
        {actionData?.errors?.name && <span>{actionData.errors.name}</span>}
        <textarea name="body" maxLength={1000} required />
        {actionData?.errors?.body && <span>{actionData.errors.body}</span>}
        <button type="submit">Sign guestbook</button>
      </Form>
      <ul>
        {loaderData.messages.map((message) => (
          <li key={message.id}>
            <strong>{message.name}</strong>: {message.body}
          </li>
        ))}
      </ul>
    </>
  );
}
```

### Testing

Tests run against the `app_test` database, so start and migrate PostgreSQL
before running them:

```bash
deno task docker:start
deno task db:migrate
deno task test
```

Close the connection pool when a test file finishes querying the database so the
test runner doesn't report a leaked resource:

```typescript
import { afterAll, describe, it } from "@std/testing/bdd";

import { closeDb } from "@/db/mod.ts";

describe("message service", () => {
  afterAll(async () => {
    await closeDb();
  });

  // ...tests that call the service
});
```

## Data Access Patterns

These are common patterns for organizing data access code. They are not
framework-specific features but recommended approaches for maintainable
applications.

### Services Pattern

Encapsulate database operations in service classes or modules:

```typescript
// services/post.ts
import { z } from "zod";
import { HttpError } from "@udibo/juniper";

export const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  authorId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Post = z.infer<typeof PostSchema>;
export type NewPost = Omit<Post, "id" | "createdAt" | "updatedAt">;

class PostService {
  private kv: Deno.Kv | undefined;

  private async getKv(): Promise<Deno.Kv> {
    if (!this.kv) {
      this.kv = await Deno.openKv();
    }
    return this.kv;
  }

  async get(id: string): Promise<Post> {
    const kv = await this.getKv();
    const entry = await kv.get<Post>(["posts", "id", id]);
    if (!entry.value) {
      throw new HttpError(404, "Post not found");
    }
    return entry.value;
  }

  async list(authorId?: string): Promise<Post[]> {
    const kv = await this.getKv();
    const prefix = authorId ? ["posts", "authorId", authorId] : ["posts", "id"];
    const entries = kv.list<Post>({ prefix });
    const posts: Post[] = [];
    for await (const entry of entries) {
      posts.push(entry.value);
    }
    return posts;
  }

  async create(data: NewPost): Promise<Post> {
    const kv = await this.getKv();
    const post: Post = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await kv.atomic()
      .set(["posts", "id", post.id], post)
      .set(["posts", "authorId", post.authorId, post.id], post)
      .commit();

    return post;
  }

  async delete(id: string): Promise<void> {
    const kv = await this.getKv();
    const post = await this.get(id);

    await kv.atomic()
      .delete(["posts", "id", id])
      .delete(["posts", "authorId", post.authorId, id])
      .commit();
  }
}

export const postService = new PostService();
```

Use the service in your routes:

```typescript
// routes/blog/[id].ts
import type { RouteLoaderArgs } from "@udibo/juniper";
import { postService } from "@/services/post.ts";

export async function loader({ params }: RouteLoaderArgs) {
  const post = await postService.get(params.id);
  return { post };
}
```

### Repository Pattern

For larger applications, separate the data access logic from business logic:

```typescript
// repositories/user.ts
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: NewUser): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}

export class KvUserRepository implements UserRepository {
  constructor(private kv: Deno.Kv) {}

  async findById(id: string): Promise<User | null> {
    const entry = await this.kv.get<User>(["users", "id", id]);
    return entry.value;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entry = await this.kv.get<User>(["users", "email", email]);
    return entry.value;
  }

  // ... other methods
}
```

```typescript
// services/user.ts
import { UserRepository } from "@/repositories/user.ts";
import { HttpError } from "@udibo/juniper";

export class UserService {
  constructor(private repo: UserRepository) {}

  async getUser(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    return user;
  }

  async registerUser(data: NewUser): Promise<User> {
    const existing = await this.repo.findByEmail(data.email);
    if (existing) {
      throw new HttpError(400, "Email already registered");
    }
    return this.repo.create(data);
  }
}
```

This pattern makes it easier to:

- Switch between different database implementations
- Mock the repository for testing
- Keep business logic separate from data access

### Validation with Zod

Use Zod schemas for runtime validation:

```typescript
import { z } from "zod";
import { HttpError } from "@udibo/juniper";

const CreatePostSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  content: z.string().min(1, "Content is required"),
});

export async function action({ request }: RouteActionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  const result = CreatePostSchema.safeParse(data);
  if (!result.success) {
    return {
      errors: result.error.issues.map((i) => i.message),
    };
  }

  const post = await postService.create({
    ...result.data,
    authorId: currentUser.id,
  });

  return redirect(`/blog/${post.id}`);
}
```

## Next Steps

**Next:** [Testing](testing.md) - Testing utilities and patterns

**Related topics:**

- [Forms](forms.md) - Form handling with client and server actions
- [Error Handling](error-handling.md) - Error boundaries and HttpError
