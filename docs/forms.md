---
title: Forms
last_verified: 2026-09-09
---

# Forms

## Overview

Juniper uses React Router's form handling built on top of standard HTML forms.
Actions process form submissions with flexible execution options:

- **Server actions** run on the server, keeping business logic and sensitive
  operations secure.
- **Client actions** run in the browser, enabling local storage updates,
  optimistic UI, and client-side enhancements.
- **Both together** allow client actions to call server actions, combining the
  benefits of both approaches.

## Server Actions

### Creating Actions

Export an `action` function from your route's `.ts` file to handle form
submissions:

```typescript
// routes/blog/create.ts
import { redirect } from "react-router";
import { HttpError } from "@udibo/juniper";
import type { RouteActionArgs } from "@udibo/juniper";
import { userContext } from "@/context/user.ts";
import { postService } from "@/services/post.ts";

export async function action(
  { request, context }: RouteActionArgs,
): Promise<void> {
  const user = context.get(userContext);
  if (!user) throw new HttpError(401, "Sign in to create a post");

  const formData = await request.formData();
  const title = formData.get("title");
  const content = formData.get("content");
  if (
    typeof title !== "string" || !title.trim() ||
    typeof content !== "string" || !content.trim()
  ) {
    throw new HttpError(400, "Title and content are required");
  }

  const post = await postService.create({
    title,
    content,
    authorId: user.id,
  });

  throw redirect(`/blog/${post.id}`);
}
```

This example assumes application-owned `postService` and `userContext` modules.
Initialize the user context in authenticated server middleware. Derive ownership
from that trusted context, not a submitted `authorId`; validate form values
because `FormData.get()` can return a string, a file, or `null`. Match this
server module with `routes/blog/create.tsx` for router submissions.

### Action Arguments

Actions receive these arguments:

```typescript
interface RouteActionArgs {
  request: Request; // The form submission request
  params: Record<string, string>; // Route parameters
  context: RouterContextProvider; // Shared context
}
```

Access form data using the standard `FormData` API:

```typescript
export async function action({
  request,
  params,
  context,
}: RouteActionArgs<{ id: string }>): Promise<void> {
  const formData = await request.formData();

  // Get single values
  const name = formData.get("name") as string;

  // Get multiple values (checkboxes, multi-select)
  const tags = formData.getAll("tags") as string[];

  // Check the HTTP method
  if (request.method === "DELETE") {
    await deleteItem(params.id);
  }

  // Access user from context
  const user = context.get(userContext);
}
```

### Returning Data

Actions can return data, redirects, or throw redirects. Action data is
automatically serialized when sent to the client. JSON-shaped data, `undefined`,
`Date`, and `Error` have built-in handling; `bigint` values are accepted with
the numeric normalization described in
[serializable values](state-management.md#serializable-values). Promise values
can defer data. Register other classes with `registerType` or convert them to
plain data before returning them.

```typescript
// Return data (available in component via actionData)
interface ActionData {
  success: boolean;
  errors?: string[];
}

export async function action(
  { request }: RouteActionArgs,
): Promise<ActionData> {
  const formData = await request.formData();
  const errors = validate(formData);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true };
}
```

Throw a redirect after success to leave the action immediately. Keep the return
type for data the component actually receives:

```typescript
import { redirect } from "react-router";

export async function action(
  { request }: RouteActionArgs,
): Promise<ActionData> {
  throw redirect("/success");
}
```

Returned redirects are also supported by server actions, but throwing uses the
same control flow in loaders, actions, and middleware. Do not catch and convert
the thrown response into ordinary action data. See
[redirects](routing.md#redirects).

Access action data in components:

```tsx
import { Form } from "react-router";
import type { AnyParams, RouteProps } from "@udibo/juniper";

interface ActionData {
  success: boolean;
  errors?: string[];
}

export default function CreateForm(
  { actionData }: RouteProps<AnyParams, unknown, ActionData>,
) {
  return (
    <Form method="post">
      {actionData?.errors && (
        <ul>
          {actionData.errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
    </Form>
  );
}
```

## Client Actions

### Creating Client Actions

Export an `action` from `.tsx` to handle client-router submissions. With no
matching `.ts` action, that same function also handles document form submissions
on the server. Guard browser-only APIs in universal actions. The example below
assumes a matching `routes/settings/index.ts` action so the browser can persist
the change with `serverAction()`:

```tsx
// routes/settings/index.tsx
import { Form } from "react-router";
import type { AnyParams, RouteActionArgs, RouteProps } from "@udibo/juniper";

interface SettingsActionData {
  success: boolean;
  message: string;
}

export async function action({
  request,
  serverAction,
}: RouteActionArgs<AnyParams, SettingsActionData>): Promise<
  SettingsActionData
> {
  const formData = await request.formData();

  // Save to local storage
  const theme = formData.get("theme") as string;
  localStorage.setItem("theme", theme);

  // Also persist to server and return server result
  return await serverAction();
}

export default function Settings(
  { actionData }: RouteProps<AnyParams, unknown, SettingsActionData>,
) {
  return (
    <Form method="post">
      <select name="theme">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <button type="submit">Save</button>
      {actionData?.message && <p>{actionData.message}</p>}
    </Form>
  );
}
```

Share action data types with type-only imports, or define them in a shared
module. A type-only import is erased from the browser bundle; a runtime import
of a server service is not. Both sides must agree on the action data shape.

### When Client Actions Run

The behavior depends on which actions are defined for a route:

| Server Action | Client Action | SSR Form Submission | Client Form Submission         |
| ------------- | ------------- | ------------------- | ------------------------------ |
| Yes           | No            | Server action runs  | Client sends request to server |
| No            | Yes           | Client action runs  | Client action runs             |
| Yes           | Yes           | Server action runs  | Client action runs             |
| No            | No            | No action handling  | No action handling             |

**Key points:**

- If a route has only a server action, form submissions are sent to the server
  to run the action during both SSR and client-side submissions.
- If a route has only a client action, it runs during both SSR and client-side
  submissions.
- If a route has both actions, the server action runs during SSR, and the client
  action runs during client-side submissions (and can optionally call the server
  action).

### Calling Server Actions from Client Actions

When a route has both a server action (in `.ts`) and a client action (in
`.tsx`), the client action can call the server action using the `serverAction`
function:

```tsx
// routes/posts/[id]/edit.tsx
import type { RouteActionArgs, RouteProps } from "@udibo/juniper";

interface EditPostActionData {
  success: boolean;
  post: Post;
}

export async function action({
  serverAction,
}: RouteActionArgs<{ id: string }, EditPostActionData>): Promise<
  EditPostActionData
> {
  // Call the server action to save the post
  const result = await serverAction();

  // Update client-side cache
  updateLocalCache(result.post);

  return result;
}

export default function EditPost(
  { actionData }: RouteProps<{ id: string }, unknown, EditPostActionData>,
) {
  return (
    <Form method="post">
      {/* form fields */}
      {actionData?.success && <p>Post saved!</p>}
    </Form>
  );
}
```

### Why Use Client Actions with Server Actions?

There are several reasons to use a client action that calls the server action:

1. **Combine server and client operations**: Persist data to the server while
   also updating local storage, IndexedDB, or other browser APIs.

2. **Client-side side effects**: Perform browser-specific operations after a
   successful server action, like showing notifications or updating caches.

3. **Transform action data**: Modify or enhance the server response before
   passing it to the component.

4. **Optimistic updates with rollback**: Update UI immediately and roll back if
   the server action fails.

```tsx
// Example: Optimistic update with rollback in routes/settings/index.tsx
import type { AnyParams, RouteActionArgs } from "@udibo/juniper";

interface SettingsActionData {
  success: boolean;
}

export async function action({
  request,
  serverAction,
}: RouteActionArgs<AnyParams, SettingsActionData>): Promise<
  SettingsActionData
> {
  const formData = await request.formData();
  const previousValue = localStorage.getItem("settings");

  // Optimistically update local storage
  localStorage.setItem("settings", formData.get("settings") as string);

  try {
    // Persist to server and return result
    return await serverAction();
  } catch (error) {
    // Rollback on failure
    if (previousValue) {
      localStorage.setItem("settings", previousValue);
    } else {
      localStorage.removeItem("settings");
    }
    throw error;
  }
}
```

## Form Component

### Form Submission

Use the `Form` component from `react-router` for enhanced form handling:

```tsx
import { Form } from "react-router";

export default function CreatePost() {
  return (
    <Form method="post">
      <input type="text" name="title" required />
      <textarea name="content" required />
      <button type="submit">Create Post</button>
    </Form>
  );
}
```

The `Form` component:

- Submits to the current route's action by default
- Prevents full page reload
- Exposes pending state through `useNavigation`; your UI renders feedback
- Revalidates loader data after submission

### Form Methods

Specify the HTTP method with the `method` prop:

```tsx
<Form method="post">
  <button type="submit">Create</button>
</Form>

<Form method="post">
  <button type="submit" name="intent" value="save">Save</button>
  <button type="submit" name="intent" value="publish">Publish</button>
</Form>

<Form method="post">
  <button type="submit" name="intent" value="delete">Delete</button>
</Form>
```

Handle different intents in your action:

```typescript
import { redirect } from "react-router";
import type { RouteActionArgs } from "@udibo/juniper";

interface PostActionData {
  success: boolean;
  message?: string;
}

export async function action({
  request,
  params,
}: RouteActionArgs<{ id: string }>): Promise<PostActionData> {
  const formData = await request.formData();
  const intent = formData.get("intent");

  switch (intent) {
    case "save":
      return await saveAsDraft(params.id, formData);
    case "publish":
      return await publish(params.id, formData);
    case "delete":
      await deletePost(params.id);
      throw redirect("/blog");
    default:
      return { success: false, message: "Unknown intent" };
  }
}
```

## Using Fetchers

### Multiple Forms

Use `useFetcher` for forms that shouldn't navigate or for multiple independent
forms. A fetcher targets an action in the client router's route tree; it is not
an arbitrary HTTP client for a server-only Hono endpoint. Use a matching `.tsx`
route for the action, or call a server-only API with `fetch`.

```tsx
import { useFetcher } from "react-router";

function LikeButton({ postId }: { postId: string }) {
  const fetcher = useFetcher();
  const isLiking = fetcher.state === "submitting";

  return (
    <fetcher.Form method="post" action={`/posts/${postId}/like`}>
      <button type="submit" disabled={isLiking}>
        {isLiking ? "Liking..." : "Like"}
      </button>
    </fetcher.Form>
  );
}
```

The example assumes matching `routes/posts/[postId]/like.tsx` and `.ts` files.
Read the result from `fetcher.data`; a fetcher submission does not populate the
page's `actionData` prop. Use a separate fetcher per independently pending form.

### Optimistic UI

Show optimistic updates while the action is pending:

```tsx
import { useFetcher } from "react-router";

function TodoItem({ todo }: { todo: Todo }) {
  const fetcher = useFetcher();

  const isComplete = fetcher.formData
    ? fetcher.formData.get("complete") === "true"
    : todo.complete;

  return (
    <fetcher.Form method="post">
      <input
        type="checkbox"
        name="complete"
        value="true"
        checked={isComplete}
        onChange={(e) =>
          fetcher.submit(e.currentTarget.form, { method: "post" })}
      />
      <span className={isComplete ? "line-through" : ""}>
        {todo.title}
      </span>
    </fetcher.Form>
  );
}
```

## Form Validation

### Server-Side Validation

Always validate on the server - client-side validation is for UX only:

```typescript
// routes/register.ts
import { redirect } from "react-router";
import type { RouteActionArgs } from "@udibo/juniper";

interface ValidationErrors {
  email?: string;
  password?: string;
}

interface RegisterActionData {
  errors: ValidationErrors;
}

export async function action(
  { request }: RouteActionArgs,
): Promise<RegisterActionData> {
  const formData = await request.formData();
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  const errors: ValidationErrors = {};

  if (!email || !email.includes("@")) {
    errors.email = "Valid email is required";
  }

  if (!password || password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  await createUser({ email, password });
  throw redirect("/login");
}
```

Display validation errors:

```tsx
// routes/register.tsx
import { Form } from "react-router";
import type { AnyParams, RouteProps } from "@udibo/juniper";

interface ValidationErrors {
  email?: string;
  password?: string;
}

interface RegisterActionData {
  errors: ValidationErrors;
}

export default function Register(
  { actionData }: RouteProps<AnyParams, unknown, RegisterActionData>,
) {
  return (
    <Form method="post">
      <div>
        <input type="email" name="email" />
        {actionData?.errors?.email && (
          <span className="text-red-500">{actionData.errors.email}</span>
        )}
      </div>

      <div>
        <input type="password" name="password" />
        {actionData?.errors?.password && (
          <span className="text-red-500">{actionData.errors.password}</span>
        )}
      </div>

      <button type="submit">Register</button>
    </Form>
  );
}
```

### Client-Side Validation

Use HTML5 validation attributes for immediate feedback:

```tsx
<Form method="post">
  <input
    type="email"
    name="email"
    required
    pattern="[^@]+@[^@]+\.[^@]+"
  />
  <input
    type="password"
    name="password"
    required
    minLength={8}
  />
  <button type="submit">Submit</button>
</Form>;
```

## File Uploads

Handle file uploads using `FormData`:

```tsx
// Component
<Form method="post" encType="multipart/form-data">
  <input type="file" name="avatar" accept="image/*" />
  <button type="submit">Upload</button>
</Form>;
```

Process the file in your action:

```typescript
// routes/profile/avatar.ts
import type { RouteActionArgs } from "@udibo/juniper";

interface AvatarActionData {
  success: boolean;
  error?: string;
  filename?: string;
}

export async function action(
  { request }: RouteActionArgs,
): Promise<AvatarActionData> {
  const formData = await request.formData();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "No file uploaded" };
  }

  if (!file.type.startsWith("image/")) {
    return { success: false, error: "File must be an image" };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "File must be less than 5MB" };
  }

  const buffer = await file.arrayBuffer();
  const filename = crypto.randomUUID();
  await Deno.mkdir("./uploads", { recursive: true });
  await Deno.writeFile(`./uploads/${filename}`, new Uint8Array(buffer));

  return { success: true, filename };
}
```

The upload example checks reported metadata and writes outside `public/` using a
server-generated name. In a real upload service, limit request size before
parsing, inspect file contents, and serve accepted files with an appropriate
content type. The browser-supplied filename and MIME type are untrusted.

## Next Steps

**Next:** [State Management](state-management.md) - Sharing data across your app

**Related topics:**

- [Error Handling](error-handling.md) - Error boundaries and HttpError
- [Database](database.md) - Deno KV and PostgreSQL
- [Testing](testing.md) - Testing utilities and patterns

## Changelog

- **2026-09-09** — Corrected action-data serialization claims, including bigint
  normalization and custom classes.

- **2026-09-09** — Removed explanatory comments from the revised submission and
  validation examples.

- **2026-09-09** — Corrected navigation pending state, fetcher action targets
  and POST submission; validated untrusted fields and uploads and derived
  ownership from server context.
