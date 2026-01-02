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
        <Link
          to={`/blog/${post.id}`}
          style={{ marginBottom: "1rem", display: "block" }}
        >
          &larr; Back to Post
        </Link>

        <h1>Edit Post</h1>

        <Form method="post">
          {actionData?.errors && (
            <div
              style={{
                padding: "1rem",
                background: "#fee",
                border: "1px solid #fcc",
                marginBottom: "1rem",
              }}
            >
              <ul>
                {Object.values(actionData.errors).map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="title"
              style={{ display: "block", marginBottom: "0.5rem" }}
            >
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
            <label
              htmlFor="content"
              style={{ display: "block", marginBottom: "0.5rem" }}
            >
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
