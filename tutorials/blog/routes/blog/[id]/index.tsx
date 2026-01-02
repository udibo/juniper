import { Form, Link } from "react-router";
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

        <time
          style={{ color: "#666", display: "block", marginBottom: "2rem" }}
        >
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
