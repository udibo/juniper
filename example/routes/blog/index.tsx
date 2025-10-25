import { Link, useLoaderData } from "react-router";
import type { Post } from "/services/post.ts";
import { postService } from "/services/post.ts";

interface BlogIndexLoaderData {
  posts: Post[];
  cursor: string;
}

export async function loader(): Promise<BlogIndexLoaderData> {
  const { entries: posts, cursor } = await postService.list({});
  return { posts, cursor: cursor || "" };
}

export default function BlogIndex() {
  const { posts } = useLoaderData() as BlogIndexLoaderData;

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <h1>Blog Posts</h1>
        <p>Welcome to our blog! Here are the latest posts:</p>
      </div>

      {posts.length === 0
        ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
            <p>No blog posts yet. Check back later!</p>
          </div>
        )
        : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            {posts.map((post) => (
              <article
                key={post.id}
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "1.5rem",
                  backgroundColor: "#fafafa",
                }}
              >
                <header style={{ marginBottom: "1rem" }}>
                  <h2 style={{ margin: 0, marginBottom: "0.5rem" }}>
                    <Link
                      to={`/blog/${post.id}`}
                      style={{
                        textDecoration: "none",
                        color: "#2563eb",
                      }}
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <div style={{ color: "#666", fontSize: "0.9rem" }}>
                    <time dateTime={new Date(post.createdAt).toISOString()}>
                      {new Date(post.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                    {new Date(post.createdAt).getTime() !==
                        new Date(post.updatedAt).getTime() && (
                      <span style={{ marginLeft: "1rem" }}>
                        (Updated:{" "}
                        {new Date(post.updatedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })})
                      </span>
                    )}
                  </div>
                </header>
                <div style={{ lineHeight: "1.6" }}>
                  <p style={{ margin: 0 }}>
                    {post.content.length > 200
                      ? `${post.content.substring(0, 200)}...`
                      : post.content}
                  </p>
                  {post.content.length > 200 && (
                    <Link
                      to={`/blog/${post.id}`}
                      style={{
                        color: "#2563eb",
                        textDecoration: "none",
                        fontWeight: "500",
                        marginTop: "0.5rem",
                        display: "inline-block",
                      }}
                    >
                      Read more →
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
    </div>
  );
}
