import type {
  ErrorBoundaryProps,
  RouteActionArgs,
  RouteLoaderArgs,
  RouteProps,
} from "@udibo/juniper";
import { HttpError } from "@udibo/http-error";
import { Link, useFetcher } from "react-router";
import { useState } from "react";

import { postService } from "@/services/post.ts";
import type { Post } from "@/services/post.ts";

interface BlogPostLoaderData {
  post: Post;
}

export async function loader(
  { params }: RouteLoaderArgs,
): Promise<BlogPostLoaderData> {
  try {
    const post = await postService.get(params.id!);
    return { post };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Failed to find")) {
      throw new HttpError(404, "Blog post not found");
    }
    throw new HttpError(500, "Failed to load blog post");
  }
}

interface EditPostActionData {
  post?: Post;
  error?: string;
  deleted?: boolean;
}

export async function action(
  { request, params }: RouteActionArgs,
): Promise<EditPostActionData> {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    try {
      await postService.delete(params.id!);
      return { deleted: true };
    } catch {
      return { error: "Failed to delete post" };
    }
  }

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  try {
    const post = await postService.patch({ id: params.id!, title, content });
    return { post };
  } catch {
    return { error: "Failed to update post" };
  }
}

export default function BlogPost({
  loaderData,
}: RouteProps<{ id: string }, BlogPostLoaderData>) {
  const post = loaderData.post;
  const fetcher = useFetcher<EditPostActionData>();
  const [isEditing, setIsEditing] = useState(false);
  const isSubmitting = fetcher.state !== "idle";

  if (fetcher.data?.deleted) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-100 mb-4">Post Deleted</h2>
        <p className="text-slate-400 mb-6">This blog post has been deleted.</p>
        <Link
          to="/blog"
          className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          ← Back to Blog
        </Link>
      </div>
    );
  }

  if (fetcher.data?.post && isEditing) {
    setIsEditing(false);
  }

  const displayPost = fetcher.data?.post || post;

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

      {isEditing
        ? (
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
            <h3 className="text-xl font-semibold mb-4 text-slate-100">
              Edit Post
            </h3>
            <fetcher.Form method="post" className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  defaultValue={displayPost.title}
                  required
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="content"
                  className="block text-sm font-medium text-slate-300 mb-2"
                >
                  Content
                </label>
                <textarea
                  id="content"
                  name="content"
                  defaultValue={displayPost.content}
                  required
                  rows={10}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>
              {fetcher.data?.error && (
                <p className="text-red-400 text-sm">{fetcher.data.error}</p>
              )}
              <div className="flex gap-4">
                <button
                  type="submit"
                  name="intent"
                  value="update"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-3 border border-slate-600 text-slate-300 hover:text-slate-100 hover:border-slate-500 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </fetcher.Form>
          </div>
        )
        : (
          <article>
            <header className="mb-8 pb-6 border-b border-slate-700/50">
              <h1 className="text-4xl font-bold text-slate-100 mb-4 leading-tight">
                {displayPost.title}
              </h1>
              <div className="text-slate-500 flex gap-4 items-center flex-wrap">
                <time dateTime={new Date(displayPost.createdAt).toISOString()}>
                  Published:{" "}
                  {new Date(displayPost.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                {new Date(displayPost.createdAt).getTime() !==
                    new Date(displayPost.updatedAt).getTime() && (
                  <time
                    dateTime={new Date(displayPost.updatedAt).toISOString()}
                  >
                    Updated:{" "}
                    {new Date(displayPost.updatedAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </time>
                )}
              </div>
            </header>

            <div className="text-slate-300 leading-relaxed text-lg whitespace-pre-wrap mb-8">
              {displayPost.content}
            </div>

            <div className="flex gap-4 pt-6 border-t border-slate-700/50">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium rounded-lg transition-colors"
              >
                Edit
              </button>
              <fetcher.Form method="post">
                <button
                  type="submit"
                  name="intent"
                  value="delete"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Deleting..." : "Delete"}
                </button>
              </fetcher.Form>
            </div>

            <footer className="mt-8 pt-6 border-t border-slate-700/50 text-slate-500 text-sm">
              Post ID: {displayPost.id} | Author: {displayPost.authorId}
            </footer>
          </article>
        )}
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
        {error instanceof Error ? error.message : "Unknown error"}
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
