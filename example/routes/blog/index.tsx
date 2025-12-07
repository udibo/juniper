import { Link, useFetcher } from "react-router";
import { useState } from "react";
import type {
  AnyParams,
  RouteActionArgs,
  RouteLoaderArgs,
  RouteProps,
} from "@udibo/juniper";

import { postService } from "@/services/post.ts";
import type { Post } from "@/services/post.ts";

interface BlogIndexLoaderData {
  posts: Post[];
  cursor: string;
}

export async function loader(
  _args: RouteLoaderArgs,
): Promise<BlogIndexLoaderData> {
  const { entries: posts, cursor } = await postService.list({});
  return { posts, cursor: cursor || "" };
}

interface NewPostActionData {
  post?: Post;
  error?: string;
}

export async function action(
  { request }: RouteActionArgs,
): Promise<NewPostActionData> {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const authorId = formData.get("authorId") as string;

  try {
    const post = await postService.create({ title, content, authorId });
    return { post };
  } catch {
    return { error: "Failed to create post" };
  }
}

function NewPostForm() {
  const fetcher = useFetcher<NewPostActionData>();
  const [isOpen, setIsOpen] = useState(false);
  const isSubmitting = fetcher.state !== "idle";

  if (fetcher.data?.post && isOpen) {
    setIsOpen(false);
  }

  return (
    <div className="mb-8">
      {!isOpen
        ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-xl transition-all hover:scale-105"
          >
            Write a Post
          </button>
        )
        : (
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
            <h3 className="text-xl font-semibold mb-4 text-slate-100">
              New Blog Post
            </h3>
            <fetcher.Form method="post" className="space-y-4">
              <input
                type="hidden"
                name="authorId"
                value="00000000-0000-0000-0000-000000000001"
              />
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
                  required
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter post title..."
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
                  required
                  rows={6}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                  placeholder="Write your post content..."
                />
              </div>
              {fetcher.data?.error && (
                <p className="text-red-400 text-sm">{fetcher.data.error}</p>
              )}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Publishing..." : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-3 border border-slate-600 text-slate-300 hover:text-slate-100 hover:border-slate-500 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </fetcher.Form>
          </div>
        )}
    </div>
  );
}

export default function BlogIndex({
  loaderData,
}: RouteProps<AnyParams, BlogIndexLoaderData>) {
  const posts = loaderData.posts;

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-100 mb-2">Blog Posts</h2>
        <p className="text-slate-400">
          Welcome to our blog! Here are the latest posts:
        </p>
      </div>

      <NewPostForm />

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
    </div>
  );
}
