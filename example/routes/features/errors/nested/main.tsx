import { Outlet, useNavigate } from "react-router";
import { HttpError } from "@udibo/juniper";
import type { ErrorBoundaryProps } from "@udibo/juniper";

import { FeatureBadge } from "@/components/FeatureBadge.tsx";

export default function NestedErrorLayout() {
  return (
    <div>
      <title>Nested Error Handling - Juniper Features</title>
      <FeatureBadge color="red">Nested Errors</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Nested Error Handling
      </h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        This example demonstrates how errors bubble up to parent error
        boundaries when a child route doesn't have its own{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          ErrorBoundary
        </code>
        .
      </p>

      <Outlet />
    </div>
  );
}

export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  const navigate = useNavigate();

  function handleTryAgain() {
    navigate("/features/errors/nested");
  }

  return (
    <div>
      <title>Parent Caught Error - Juniper Features</title>
      <FeatureBadge color="red">Parent ErrorBoundary</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Parent Route Caught the Error!
      </h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        The child route threw an error but doesn't have its own{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          ErrorBoundary
        </code>
        . The error bubbled up to this parent route's ErrorBoundary.
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
          onClick={handleTryAgain}
          className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>

      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          How Error Bubbling Works
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-slate-300">
          <li>Child route throws an error</li>
          <li>React Router looks for the nearest ErrorBoundary</li>
          <li>Child route has no ErrorBoundary, so it bubbles up</li>
          <li>Parent route's ErrorBoundary catches and displays the error</li>
        </ol>
      </div>
    </div>
  );
}
