# Database

## Overview

Juniper doesn't prescribe a specific database solution, giving you the
flexibility to choose what works best for your project. This guide covers Deno
KV (built into Deno) and patterns for connecting to other databases.

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

## Other Databases

Juniper works with any database that has a Deno-compatible driver.

### PostgreSQL

Use `postgres` (via npm) for PostgreSQL connections:

```json
{
  "imports": {
    "postgres": "npm:postgres@^3.4.4"
  }
}
```

```typescript
// services/db.ts
import postgres from "postgres";

const sql = postgres(Deno.env.get("DATABASE_URL") ?? "");

export { sql };
```

```typescript
// services/user.ts
import { sql } from "./db.ts";

export interface User {
  id: string;
  email: string;
  name: string;
}

export async function getUser(id: string): Promise<User | null> {
  const [user] = await sql<User[]>`
    SELECT id, email, name FROM users WHERE id = ${id}
  `;
  return user ?? null;
}

export async function createUser(user: Omit<User, "id">): Promise<User> {
  const [created] = await sql<User[]>`
    INSERT INTO users (email, name)
    VALUES (${user.email}, ${user.name})
    RETURNING id, email, name
  `;
  return created;
}
```

### SQLite

Use `better-sqlite3` or Deno's built-in SQLite for local databases:

```typescript
// Using Deno's built-in SQLite (requires --unstable-ffi)
const db = new Deno.Sqlite("./data/app.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
  )
`);

export function getUser(id: string) {
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  return stmt.get(id);
}
```

### MongoDB

Use the official MongoDB driver:

```json
{
  "imports": {
    "mongodb": "npm:mongodb@^6.3.0"
  }
}
```

```typescript
// services/db.ts
import { MongoClient } from "mongodb";

const client = new MongoClient(Deno.env.get("MONGODB_URI") ?? "");
await client.connect();

export const db = client.db("myapp");
export const users = db.collection("users");
```

```typescript
// services/user.ts
import { users } from "./db.ts";
import { ObjectId } from "mongodb";

export async function getUser(id: string) {
  return await users.findOne({ _id: new ObjectId(id) });
}

export async function createUser(user: { email: string; name: string }) {
  const result = await users.insertOne(user);
  return { ...user, _id: result.insertedId };
}
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
