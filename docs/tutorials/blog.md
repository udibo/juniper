# Building a Blog Application

This tutorial walks you through building a full-featured blog application with
Juniper. You'll learn how to:

- Set up a Juniper project from scratch
- Create routes with file-based routing
- Load data with server loaders
- Handle form submissions with actions
- Build a REST API with Hono
- Use Deno KV for data storage

## Prerequisites

Before starting, make sure you have [Deno](https://deno.com/) installed (version
2.0 or later).

## Getting the Finished Code

If you want to explore the finished application or use it as a starting point,
you can clone the completed tutorial:

```bash
deno run -A npm:degit udibo/juniper/tutorials/blog my-blog
cd my-blog
deno install
deno task dev
```

Open http://localhost:8000 to see the running application.

## Setting Up the Project

Start by cloning the minimal template:

```bash
deno run -A npm:degit udibo/juniper/templates/minimal my-blog
cd my-blog
deno install
```

Your project structure looks like this:

```
my-blog/
├── deno.json
├── .env
├── .env.production
├── .env.test
├── main.ts
├── main.tsx
├── utils/
│   └── otel.ts
├── routes/
│   ├── main.ts
│   ├── main.tsx
│   └── index.tsx
└── public/
    └── favicon.ico
```

Start the development server to verify everything works:

```bash
deno task dev
```

Open http://localhost:8000 to see the default page.

### Configuring the Application

Update the `.env` file to set your application name:

```bash
APP_NAME="My Blog"
APP_ENV=development
NODE_ENV=development
OTEL_DENO=true
OTEL_SERVICE_NAME="My Blog"
```

The `APP_NAME` is used for logging and error messages. You can change it to
whatever you like.

Next, update `routes/main.tsx` to remove the default heading and add some basic
styling:

```tsx
// routes/main.tsx
import { Outlet } from "react-router";
import type { ErrorBoundaryProps } from "@udibo/juniper";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <link rel="icon" href="/favicon.ico" />
      {children}
    </main>
  );
}

export default function Main() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  let name = "Error";
  let message = "An unexpected error occurred.";
  if (error instanceof Error) {
    name = error.name;
    message = error.message;
  }

  return (
    <Layout>
      <h1>{name}</h1>
      <p>{message}</p>
    </Layout>
  );
}
```

This layout wraps all pages with a centered container and provides a fallback
error boundary.

## Creating the Post Service

First, create a service to manage blog posts using Deno KV.

Create a new file at `services/post.ts`:

```typescript
// services/post.ts
import { HttpError } from "@udibo/juniper";

export interface Post {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewPost = Pick<Post, "title" | "content">;

let kv: Deno.Kv | undefined;

async function getKv(): Promise<Deno.Kv> {
  if (!kv) {
    kv = await Deno.openKv();
  }
  return kv;
}

export const postService = {
  async get(id: string): Promise<Post> {
    const db = await getKv();
    const entry = await db.get<Post>(["posts", id]);
    if (!entry.value) {
      throw new HttpError(404, "Post not found");
    }
    return entry.value;
  },

  async list(): Promise<Post[]> {
    const db = await getKv();
    const entries: Post[] = [];
    const iter = db.list<Post>({ prefix: ["posts"] });

    for await (const entry of iter) {
      entries.push(entry.value);
    }

    // Sort by creation date, newest first
    entries.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return entries;
  },

  async create(data: NewPost): Promise<Post> {
    const db = await getKv();
    const id = crypto.randomUUID();
    const now = new Date();

    const post: Post = {
      id,
      ...data,
      excerpt: data.content.slice(0, 150) + (data.content.length > 150 ? "..." : ""),
      createdAt: now,
      updatedAt: now,
    };

    await db.set(["posts", id], post);
    return post;
  },

  async update(id: string, data: Partial<NewPost>): Promise<Post> {
    const db = await getKv();
    const existing = await this.get(id);

    const updated: Post = {
      ...existing,
      ...data,
      excerpt: data.content
        ? data.content.slice(0, 150) + (data.content.length > 150 ? "..." : "")
        : existing.excerpt,
      updatedAt: new Date(),
    };

    await db.set(["posts", id], updated);
    return updated;
  },

  async delete(id: string): Promise<void> {
    const db = await getKv();
    await this.get(id); // Ensure it exists
    await db.delete(["posts", id]);
  },
};
```

This service provides CRUD operations for blog posts using Deno KV as the
database.

## Creating the Blog Routes

### Blog Index Page

Create a folder for blog routes and add the index page.

Create `routes/blog/index.tsx`:

```tsx
// routes/blog/index.tsx
import { Link } from "react-router";
import type { RouteProps } from "@udibo/juniper";
import type { Post } from "@/services/post.ts";

export interface BlogIndexLoaderData {
  posts: Post[];
}

export default function BlogIndex({
  loaderData,
}: RouteProps<Record<string, never>, BlogIndexLoaderData>) {
  return (
    <>
      <title>Blog</title>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1>Blog</h1>
          <Link to="/blog/new">New Post</Link>
        </div>

        {loaderData.posts.length === 0 ? (
          <p>No posts yet. Create your first post!</p>
        ) : (
          <div>
            {loaderData.posts.map((post) => (
              <article key={post.id} style={{ marginBottom: "2rem", paddingBottom: "1rem", borderBottom: "1px solid #eee" }}>
                <Link to={`/blog/${post.id}`}>
                  <h2>{post.title}</h2>
                </Link>
                <p>{post.excerpt}</p>
                <time style={{ color: "#666", fontSize: "0.875rem" }}>
                  {new Date(post.createdAt).toLocaleDateString()}
                </time>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

Create the server loader at `routes/blog/index.ts`:

```typescript
// routes/blog/index.ts
import type { RouteLoaderArgs } from "@udibo/juniper";
import { postService } from "@/services/post.ts";

export async function loader(_args: RouteLoaderArgs) {
  const posts = await postService.list();
  return { posts };
}
```

### Single Post Page

Create a dynamic route for viewing individual posts.

Create `routes/blog/[id]/index.tsx`:

```tsx
// routes/blog/[id]/index.tsx
import { Link, Form } from "react-router";
import { HttpError } from "@udibo/juniper";
import type { ErrorBoundaryProps, RouteProps } from "@udibo/juniper";
import type { Post } from "@/services/post.ts";

export default function BlogPost({
  loaderData,
}: RouteProps<{ id: string }, { post: Post }>) {
  const post = loaderData.post;

  return (
    <>
      <title>{post.title}</title>
      <article>
        <Link to="/blog" style={{ marginBottom: "1rem", display: "block" }}>
          &larr; Back to Blog
        </Link>

        <h1>{post.title}</h1>

        <time style={{ color: "#666", display: "block", marginBottom: "2rem" }}>
          {new Date(post.createdAt).toLocaleDateString()}
        </time>

        <div style={{ marginBottom: "2rem", whiteSpace: "pre-wrap" }}>
          {post.content}
        </div>

        <div style={{ display: "flex", gap: "1rem" }}>
          <Link to={`/blog/${post.id}/edit`}>Edit</Link>
          <Form method="post">
            <button type="submit" name="intent" value="delete">
              Delete
            </button>
          </Form>
        </div>
      </article>
    </>
  );
}

export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  return (
    <>
      <title>Post Not Found</title>
      <div style={{ textAlign: "center", padding: "3rem" }}>
        <h1>Post Not Found</h1>
        <p>
          {error instanceof HttpError
            ? error.exposedMessage
            : "An error occurred."}
        </p>
        <Link to="/blog">&larr; Back to Blog</Link>
      </div>
    </>
  );
}
```

Create the server loader and action at `routes/blog/[id]/index.ts`:

```typescript
// routes/blog/[id]/index.ts
import type { RouteLoaderArgs, RouteActionArgs } from "@udibo/juniper";
import { redirect } from "react-router";
import { postService } from "@/services/post.ts";

export async function loader({ params }: RouteLoaderArgs<{ id: string }>) {
  const post = await postService.get(params.id);
  return { post };
}

export async function action({
  params,
  request,
}: RouteActionArgs<{ id: string }>) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await postService.delete(params.id);
    return redirect("/blog");
  }

  return null;
}
```

### Create Post Page

Create a form for adding new posts.

Create `routes/blog/new.tsx`:

```tsx
// routes/blog/new.tsx
import { Form, Link, useNavigation } from "react-router";
import type { RouteProps } from "@udibo/juniper";

interface ActionData {
  errors?: Record<string, string>;
  values?: { title: string; content: string };
}

export default function NewPost({ actionData }: RouteProps<Record<string, never>, never, ActionData>) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <>
      <title>New Post</title>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <Link to="/blog" style={{ marginBottom: "1rem", display: "block" }}>
          &larr; Back to Blog
        </Link>

        <h1>New Post</h1>

        <Form method="post">
          {actionData?.errors && (
            <div style={{ padding: "1rem", background: "#fee", border: "1px solid #fcc", marginBottom: "1rem" }}>
              <ul>
                {Object.values(actionData.errors).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="title" style={{ display: "block", marginBottom: "0.5rem" }}>
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              style={{ width: "100%", padding: "0.5rem" }}
              defaultValue={actionData?.values?.title}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="content" style={{ display: "block", marginBottom: "0.5rem" }}>
              Content
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={10}
              style={{ width: "100%", padding: "0.5rem" }}
              defaultValue={actionData?.values?.content}
            />
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Post"}
          </button>
        </Form>
      </div>
    </>
  );
}
```

Create the server action at `routes/blog/new.ts`:

```typescript
// routes/blog/new.ts
import type { RouteActionArgs } from "@udibo/juniper";
import { redirect } from "react-router";
import { postService } from "@/services/post.ts";

export async function action({ request }: RouteActionArgs) {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  // Validate
  const errors: Record<string, string> = {};
  if (!title || title.length < 3) {
    errors.title = "Title must be at least 3 characters";
  }
  if (!content || content.length < 10) {
    errors.content = "Content must be at least 10 characters";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values: { title, content } };
  }

  const post = await postService.create({ title, content });
  return redirect(`/blog/${post.id}`);
}
```

### Edit Post Page

Create a form for editing existing posts.

Create `routes/blog/[id]/edit.tsx`:

```tsx
// routes/blog/[id]/edit.tsx
import { Form, Link, useNavigation } from "react-router";
import type { RouteProps } from "@udibo/juniper";
import type { Post } from "@/services/post.ts";

interface ActionData {
  errors?: Record<string, string>;
  values?: { title: string; content: string };
}

export default function EditPost({
  loaderData,
  actionData,
}: RouteProps<{ id: string }, { post: Post }, ActionData>) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const post = loaderData.post;

  return (
    <>
      <title>Edit: {post.title}</title>
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <Link to={`/blog/${post.id}`} style={{ marginBottom: "1rem", display: "block" }}>
          &larr; Back to Post
        </Link>

        <h1>Edit Post</h1>

        <Form method="post">
          {actionData?.errors && (
            <div style={{ padding: "1rem", background: "#fee", border: "1px solid #fcc", marginBottom: "1rem" }}>
              <ul>
                {Object.values(actionData.errors).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="title" style={{ display: "block", marginBottom: "0.5rem" }}>
              Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              style={{ width: "100%", padding: "0.5rem" }}
              defaultValue={actionData?.values?.title ?? post.title}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="content" style={{ display: "block", marginBottom: "0.5rem" }}>
              Content
            </label>
            <textarea
              id="content"
              name="content"
              required
              rows={10}
              style={{ width: "100%", padding: "0.5rem" }}
              defaultValue={actionData?.values?.content ?? post.content}
            />
          </div>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </Form>
      </div>
    </>
  );
}
```

Create the server loader and action at `routes/blog/[id]/edit.ts`:

```typescript
// routes/blog/[id]/edit.ts
import type { RouteLoaderArgs, RouteActionArgs } from "@udibo/juniper";
import { redirect } from "react-router";
import { postService } from "@/services/post.ts";

export async function loader({ params }: RouteLoaderArgs<{ id: string }>) {
  const post = await postService.get(params.id);
  return { post };
}

export async function action({
  params,
  request,
}: RouteActionArgs<{ id: string }>) {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  // Validate
  const errors: Record<string, string> = {};
  if (!title || title.length < 3) {
    errors.title = "Title must be at least 3 characters";
  }
  if (!content || content.length < 10) {
    errors.content = "Content must be at least 10 characters";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values: { title, content } };
  }

  await postService.update(params.id, { title, content });
  return redirect(`/blog/${params.id}`);
}
```

## Adding an API

Now let's add a REST API alongside the web routes. This allows external clients
to interact with your blog.

Create `routes/api/main.ts`:

```typescript
// routes/api/main.ts
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// Enable CORS for API routes
app.use(cors());

export default app;
```

Create `routes/api/posts.ts`:

```typescript
// routes/api/posts.ts
import { Hono } from "hono";
import { postService, type NewPost } from "@/services/post.ts";

const app = new Hono();

// GET /api/posts - List all posts
app.get("/", async (c) => {
  const posts = await postService.list();
  return c.json({ data: posts });
});

// GET /api/posts/:id - Get a single post
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const post = await postService.get(id);
  return c.json({ data: post });
});

// POST /api/posts - Create a post
app.post("/", async (c) => {
  const body = await c.req.json<NewPost>();

  // Validate
  if (!body.title || body.title.length < 3) {
    return c.json({ error: "Title must be at least 3 characters" }, 400);
  }
  if (!body.content || body.content.length < 10) {
    return c.json({ error: "Content must be at least 10 characters" }, 400);
  }

  const post = await postService.create(body);
  return c.json({ data: post }, 201);
});

// PUT /api/posts/:id - Update a post
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Partial<NewPost>>();

  // Validate
  if (body.title !== undefined && body.title.length < 3) {
    return c.json({ error: "Title must be at least 3 characters" }, 400);
  }
  if (body.content !== undefined && body.content.length < 10) {
    return c.json({ error: "Content must be at least 10 characters" }, 400);
  }

  const post = await postService.update(id, body);
  return c.json({ data: post });
});

// DELETE /api/posts/:id - Delete a post
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await postService.delete(id);
  return c.body(null, 204);
});

export default app;
```

Now you can test your API:

```bash
# List posts
curl http://localhost:8000/api/posts

# Create a post
curl -X POST http://localhost:8000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello World", "content": "This is my first post via the API!"}'

# Get a specific post
curl http://localhost:8000/api/posts/<post-id>

# Update a post
curl -X PUT http://localhost:8000/api/posts/<post-id> \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'

# Delete a post
curl -X DELETE http://localhost:8000/api/posts/<post-id>
```

## Updating the Home Page

Update your home page to link to the blog.

Edit `routes/index.tsx`:

```tsx
// routes/index.tsx
import { Link } from "react-router";

export default function Home() {
  return (
    <>
      <title>My Blog</title>
      <div style={{ textAlign: "center", padding: "3rem" }}>
        <h1>Welcome to My Blog</h1>
        <p>A simple blog built with Juniper.</p>
        <Link to="/blog">View Posts &rarr;</Link>
      </div>
    </>
  );
}
```

## Final Project Structure

Your completed project should look like this:

```
my-blog/
├── deno.json
├── .env
├── .env.production
├── .env.test
├── main.ts
├── main.tsx
├── services/
│   └── post.ts
├── utils/
│   └── otel.ts
├── routes/
│   ├── main.ts
│   ├── main.tsx
│   ├── index.tsx
│   ├── api/
│   │   ├── main.ts
│   │   └── posts.ts
│   └── blog/
│       ├── index.ts
│       ├── index.tsx
│       ├── new.ts
│       ├── new.tsx
│       └── [id]/
│           ├── index.ts
│           ├── index.tsx
│           ├── edit.ts
│           └── edit.tsx
└── public/
    └── favicon.ico
```

## Running the Application

Start the development server:

```bash
deno task dev
```

Visit http://localhost:8000 to see your blog. You can:

- View the home page at `/`
- Browse posts at `/blog`
- Create new posts at `/blog/new`
- View individual posts at `/blog/:id`
- Edit posts at `/blog/:id/edit`
- Access the API at `/api/posts`

## Next Steps

You've built a working blog application that demonstrates Juniper's core
concepts. However, this application is **not production-ready** - anyone can
create, edit, or delete posts.

Before deploying to production, you should:

- **Add authentication** - Protect the create/edit/delete actions (see
  [Middleware](../middleware.md)). This is essential for any real application.
- **Add input sanitization** - Sanitize user input to prevent XSS attacks
- **Add rate limiting** - Prevent abuse of your API endpoints

Additional enhancements:

- **Add styling** - Use TailwindCSS for a polished look (see
  [Styling](../styling.md))
- **Add pagination** - Handle large numbers of posts
- **Add search** - Let users search for posts
- **Add categories or tags** - Organize posts by topic

**Related topics:**

- [Routing](../routing.md) - File-based routing and data loading
- [Forms](../forms.md) - Form handling and validation
- [Error Handling](../error-handling.md) - Error boundaries and HttpError
- [Deployment](../deployment.md) - Deploy your application
