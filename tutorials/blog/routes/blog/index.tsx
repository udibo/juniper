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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <h1>Blog</h1>
          <Link to="/blog/new">New Post</Link>
        </div>

        {loaderData.posts.length === 0
          ? <p>No posts yet. Create your first post!</p>
          : (
            <div>
              {loaderData.posts.map((post) => (
                <article
                  key={post.id}
                  style={{
                    marginBottom: "2rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid #eee",
                  }}
                >
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
