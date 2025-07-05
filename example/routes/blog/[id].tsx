import {
  Link,
  type LoaderFunctionArgs,
  useLoaderData,
  useParams,
} from "react-router";
import type { Post } from "/services/post.ts";
import { postService } from "/services/post.ts";

interface BlogPostLoaderData {
  post: Post;
}

export async function loader(
  { params }: LoaderFunctionArgs,
): Promise<BlogPostLoaderData> {
  try {
    const post = await postService.get(params.id!);
    return { post };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Failed to find")) {
      throw new Response("Blog post not found", { status: 404 });
    }
    throw new Response("Failed to load blog post", { status: 500 });
  }
}

export default function BlogPost() {
  const { post } = useLoaderData() as BlogPostLoaderData;

  return (
    <div>
      <nav style={{ marginBottom: "2rem" }}>
        <Link
          to="/blog"
          style={{
            textDecoration: "none",
            color: "#2563eb",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          ← Back to Blog
        </Link>
      </nav>

      <article>
        <header
          style={{
            marginBottom: "2rem",
            borderBottom: "1px solid #e0e0e0",
            paddingBottom: "1rem",
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: "1rem",
              fontSize: "2.5rem",
              lineHeight: "1.2",
            }}
          >
            {post.title}
          </h1>
          <div
            style={{
              color: "#666",
              fontSize: "0.9rem",
              display: "flex",
              gap: "1rem",
              alignItems: "center",
            }}
          >
            <time dateTime={post.createdAt.toString()}>
              Published: {new Date(post.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            {post.createdAt !== post.updatedAt && (
              <time dateTime={post.updatedAt.toString()}>
                Updated: {new Date(post.updatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            )}
          </div>
        </header>

        <div
          style={{
            lineHeight: "1.8",
            fontSize: "1.1rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            marginBottom: "2rem",
          }}
        >
          {post.content}
        </div>

        <footer
          style={{
            borderTop: "1px solid #e0e0e0",
            paddingTop: "1rem",
            color: "#666",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            Post ID: {post.id} | Author: {post.authorId}
          </p>
        </footer>
      </article>
    </div>
  );
}

export function ErrorBoundary() {
  const params = useParams();

  return (
    <div style={{ textAlign: "center", padding: "2rem" }}>
      <h1>Blog Post Not Found</h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        {params.id
          ? `Sorry, we couldn't find a blog post with ID "${params.id}".`
          : "Sorry, we couldn't find that blog post."}
      </p>
      <Link
        to="/blog"
        style={{
          textDecoration: "none",
          color: "#2563eb",
          fontWeight: "500",
        }}
      >
        ← Back to Blog
      </Link>
    </div>
  );
}
