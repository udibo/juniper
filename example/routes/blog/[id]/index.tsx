import { HttpError } from "@udibo/juniper";
import type { ErrorBoundaryProps, RouteProps } from "@udibo/juniper";
import { Form, Link } from "react-router";

import type { Post } from "@/services/post.ts";

export interface BlogPostLoaderData {
  post: Post;
}

export default function BlogPost({
  loaderData,
}: RouteProps<{ id: string }, BlogPostLoaderData>) {
  const post = loaderData.post;

  return (
    <div>
      <nav className="mb-8">
        <Link
          to="/blog"
          className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-2 transition-colors"
        >
          ← Back to Blog
        </Link>
      </nav>

      <article>
        <header className="mb-8 pb-6 border-b border-slate-700/50">
          <h1 className="text-4xl font-bold text-slate-100 mb-4 leading-tight">
            {post.title}
          </h1>
          <div className="text-slate-500 flex gap-4 items-center flex-wrap">
            <time dateTime={new Date(post.createdAt).toISOString()}>
              Published: {new Date(post.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            {new Date(post.createdAt).getTime() !==
                new Date(post.updatedAt).getTime() && (
              <time dateTime={new Date(post.updatedAt).toISOString()}>
                Updated: {new Date(post.updatedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            )}
          </div>
        </header>

        <div className="text-slate-300 leading-relaxed text-lg whitespace-pre-wrap mb-8">
          {post.content}
        </div>

        <div className="flex gap-4 pt-6 border-t border-slate-700/50">
          <Link
            to={`/blog/${post.id}/edit`}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium rounded-lg transition-colors"
          >
            Edit
          </Link>
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="delete"
              className="px-5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Delete
            </button>
          </Form>
        </div>

        <footer className="mt-8 pt-6 border-t border-slate-700/50 text-slate-500 text-sm">
          Post ID: {post.id} | Author: {post.authorId}
        </footer>
      </article>
    </div>
  );
}

export function ErrorBoundary({
  error,
  params,
}: ErrorBoundaryProps<{ id: string }, BlogPostLoaderData>) {
  return (
    <div className="text-center py-12">
      <h1 className="text-3xl font-bold text-slate-100 mb-4">
        Blog Post Not Found
      </h1>
      <p className="text-slate-400 mb-6">
        {params.id
          ? `Sorry, we couldn't find a blog post with ID "${params.id}".`
          : "Sorry, we couldn't find that blog post."}
      </p>
      <p className="text-slate-500 mb-8">
        {error instanceof HttpError && !error.expose
          ? "Server error"
          : (error instanceof Error ? error.message : String(error))}
      </p>
      <Link
        to="/blog"
        className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
      >
        ← Back to Blog
      </Link>
    </div>
  );
}
