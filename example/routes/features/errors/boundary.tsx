import { useState } from "react";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";

export default function ErrorBoundaryDemo() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error(
      "This error was intentionally thrown to demonstrate ErrorBoundary!",
    );
  }

  return (
    <div>
      <title>Error Boundary - Juniper Features</title>
      <FeatureBadge color="red">Error Boundary</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">Error Boundary</h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        Error boundaries catch JavaScript errors in child components and display
        a fallback UI. Export an{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          ErrorBoundary
        </code>{" "}
        component from your route module to handle errors gracefully.
      </p>

      <InfoBox title="Trigger an Error" color="red" className="mb-6">
        <p className="text-slate-300 mb-4">
          Click the button below to intentionally throw an error. The parent
          route's ErrorBoundary will catch it and display a fallback UI.
        </p>
        <button
          type="button"
          onClick={() => setShouldThrow(true)}
          className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors"
        >
          Throw Error
        </button>
      </InfoBox>

      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          How It Works
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-slate-300">
          <li>
            Export an{" "}
            <code className="px-1 py-0.5 bg-slate-700 rounded text-emerald-400">
              ErrorBoundary
            </code>{" "}
            component from a route module
          </li>
          <li>When an error occurs in child routes, the boundary catches it</li>
          <li>The boundary displays your custom error UI</li>
          <li>
            Use{" "}
            <code className="px-1 py-0.5 bg-slate-700 rounded text-emerald-400">
              resetErrorBoundary
            </code>{" "}
            to allow users to retry
          </li>
        </ol>
      </div>

      <CodeBlock>
        {`import { HttpError } from "@udibo/juniper";

// routes/features/errors/main.tsx
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
}

// routes/features/errors/boundary.tsx
export default function Page() {
  const [shouldThrow, setShouldThrow] = useState(false);
  
  if (shouldThrow) {
    throw new Error("Oops!");
  }
  
  return (
    <button onClick={() => setShouldThrow(true)}>
      Throw Error
    </button>
  );
}`}
      </CodeBlock>
    </div>
  );
}
