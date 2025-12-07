import { Link, Outlet } from "react-router";
import type { ErrorBoundaryProps } from "@udibo/juniper";

export default function Main() {
  return (
    <>
      <meta charSet="utf-8" />
      <meta
        name="viewport"
        content="width=device-width,initial-scale=1.0"
      />
      <link rel="stylesheet" href="/build/main.css" />
      <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
        <nav className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="text-2xl font-bold tracking-tight text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Juniper
              </Link>
              <div className="flex gap-8">
                <Link
                  to="/features"
                  className="text-slate-300 hover:text-emerald-400 transition-colors font-medium"
                >
                  Features
                </Link>
                <Link
                  to="/blog"
                  className="text-slate-300 hover:text-emerald-400 transition-colors font-medium"
                >
                  Blog
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-12">
          <Outlet />
        </main>
      </div>
    </>
  );
}

export function ErrorBoundary(
  { error, resetErrorBoundary }: ErrorBoundaryProps,
) {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-4xl font-bold text-red-400 mb-4">
          Something went wrong
        </h1>
        <p className="text-slate-300 mb-6">
          {error instanceof Error
            ? error.message
            : "An unexpected error occurred"}
        </p>
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
