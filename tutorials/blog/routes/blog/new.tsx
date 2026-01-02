import { Form, Link, useNavigation } from "react-router";
import type { RouteProps } from "@udibo/juniper";

interface ActionData {
  errors?: Record<string, string>;
  values?: { title: string; content: string };
}

export default function NewPost({
  actionData,
}: RouteProps<Record<string, never>, never, ActionData>) {
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
              defaultValue={actionData?.values?.title}
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
