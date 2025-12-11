import { Form, Link } from "react-router";
import type { AnyParams, RouteProps } from "@udibo/juniper";

export interface CreatePostActionData {
  error?: string;
}

export default function CreatePost({
  actionData,
}: RouteProps<AnyParams, undefined, CreatePostActionData>) {
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

      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
        <h1 className="text-2xl font-bold mb-6 text-slate-100">
          Write a New Post
        </h1>
        <Form method="post" className="space-y-4">
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
              rows={10}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
              placeholder="Write your post content..."
            />
          </div>
          {actionData?.error && (
            <p className="text-red-400 text-sm">{actionData.error}</p>
          )}
          <div className="flex gap-4">
            <button
              type="submit"
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Publish
            </button>
            <Link
              to="/blog"
              className="px-6 py-3 border border-slate-600 text-slate-300 hover:text-slate-100 hover:border-slate-500 rounded-lg transition-colors inline-flex items-center"
            >
              Cancel
            </Link>
          </div>
        </Form>
      </div>
    </div>
  );
}
