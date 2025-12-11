import { Link } from "react-router";
import type { AnyParams, RouteProps } from "@udibo/juniper";

import { encodePrevStack, PREV_STACK_LIMIT } from "./index.ts";
import type { BlogIndexLoaderData } from "./index.ts";

function buildSearchParams(
  limit: number,
  cursor?: string,
  prevCursors?: string[],
): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  const prevParam = encodePrevStack(prevCursors ?? []);
  if (prevParam) {
    params.set("prev", prevParam);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  return params.toString();
}

export default function BlogIndex({
  loaderData,
}: RouteProps<AnyParams, BlogIndexLoaderData>) {
  const posts = loaderData.posts;
  const hasNext = loaderData.cursor !== "";
  const hasPrevious = loaderData.prevCursors.length > 0;
  const nextPrevCursors = [...loaderData.prevCursors, loaderData.currentCursor]
    .slice(-PREV_STACK_LIMIT);
  const previousCursor = hasPrevious
    ? loaderData.prevCursors[loaderData.prevCursors.length - 1]
    : "";
  const previousPrevCursors = hasPrevious
    ? loaderData.prevCursors.slice(0, -1)
    : [];
  const nextSearch = hasNext
    ? buildSearchParams(
      loaderData.limit,
      loaderData.cursor,
      nextPrevCursors,
    )
    : "";
  const previousSearch = hasPrevious
    ? buildSearchParams(
      loaderData.limit,
      previousCursor || undefined,
      previousPrevCursors,
    )
    : "";

  return (
    <div>
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Blog Posts</h2>
          <p className="text-slate-400">
            Welcome to our blog! Here are the latest posts:
          </p>
        </div>
        <Link
          to="/blog/create"
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-xl transition-all hover:scale-105"
        >
          Write a Post
        </Link>
      </div>

      {posts.length === 0
        ? (
          <div className="text-center py-12 text-slate-400">
            <p>No blog posts yet. Be the first to write one!</p>
          </div>
        )
        : (
          <div className="space-y-6">
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 hover:border-emerald-500/30 transition-colors"
              >
                <header className="mb-4">
                  <h2 className="text-xl font-semibold mb-2">
                    <Link
                      to={`/blog/${post.id}`}
                      className="text-slate-100 hover:text-emerald-400 transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <div className="text-sm text-slate-500">
                    <time dateTime={new Date(post.createdAt).toISOString()}>
                      {new Date(post.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                    {new Date(post.createdAt).getTime() !==
                        new Date(post.updatedAt).getTime() && (
                      <span className="ml-3">
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
                <div className="text-slate-300 leading-relaxed">
                  <p>
                    {post.content.length > 200
                      ? `${post.content.substring(0, 200)}...`
                      : post.content}
                  </p>
                  {post.content.length > 200 && (
                    <Link
                      to={`/blog/${post.id}`}
                      className="text-emerald-400 hover:text-emerald-300 font-medium mt-3 inline-block transition-colors"
                    >
                      Read more →
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

      <div className="mt-8 flex items-center justify-between">
        <div className="text-sm text-slate-400">
          Showing newest posts first
        </div>
        <div className="flex gap-3">
          {hasPrevious
            ? (
              <Link
                to={`/blog${previousSearch ? `?${previousSearch}` : ""}`}
                className="px-4 py-2 rounded-lg font-medium border border-slate-700 bg-slate-800/60 text-slate-100 hover:bg-slate-700/70 transition-colors"
              >
                Previous
              </Link>
            )
            : (
              <span className="px-4 py-2 rounded-lg font-medium border border-slate-800 bg-slate-900/60 text-slate-600 cursor-not-allowed">
                Previous
              </span>
            )}
          {hasNext
            ? (
              <Link
                to={`/blog${nextSearch ? `?${nextSearch}` : ""}`}
                className="px-4 py-2 rounded-lg font-medium border border-emerald-500 bg-emerald-500 text-slate-900 hover:bg-emerald-400 transition-colors"
              >
                Next
              </Link>
            )
            : (
              <span className="px-4 py-2 rounded-lg font-medium border border-slate-800 bg-slate-900/60 text-slate-600 cursor-not-allowed">
                Next
              </span>
            )}
        </div>
      </div>
    </div>
  );
}
