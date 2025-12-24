import { Outlet } from "react-router";
import { HttpError } from "@udibo/juniper";
import type { ErrorBoundaryProps } from "@udibo/juniper";

export default function ErrorsLayout() {
  return <Outlet />;
}

export function ErrorBoundary(
  { error, resetErrorBoundary }: ErrorBoundaryProps,
) {
  return (
    <div>
      <title>Error Boundary - Juniper Features</title>
      <div className="flex items-center gap-3 mb-6">
        <span className="px-3 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded-full uppercase tracking-wide">
          Error Boundary
        </span>
      </div>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Error Caught!</h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        This{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          ErrorBoundary
        </code>{" "}
        component caught an error from a child route. Error boundaries prevent
        the entire app from crashing when an error occurs.
      </p>

      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-4">
          Error Details
        </h3>
        <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
          <p className="text-red-300 font-mono text-sm">
            {error instanceof HttpError && !error.expose
              ? "Server error"
              : (error instanceof Error ? error.message : String(error))}
          </p>
        </div>
        <button
          type="button"
          onClick={resetErrorBoundary}
          className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>

      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Example Code
        </h3>
        <pre className="text-sm text-slate-300 font-mono overflow-x-auto">
        {`import { HttpError } from "@udibo/juniper";

export function ErrorBoundary({
  error,
  resetErrorBoundary
}: ErrorBoundaryProps) {
  return (
    <div>
      <h1>Something went wrong</h1>
      <p>{error instanceof HttpError && !error.expose ? "Server error" : (error instanceof Error ? error.message : String(error))}</p>
      <button onClick={resetErrorBoundary}>
        Try Again
      </button>
    </div>
  );
}`}
        </pre>
      </div>
    </div>
  );
}
