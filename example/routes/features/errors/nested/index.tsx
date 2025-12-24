import { Link } from "react-router";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";

export default function NestedErrorIndex() {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Route Structure
        </h3>
        <pre className="text-sm text-slate-300 font-mono overflow-x-auto">
{`routes/features/errors/nested/
├── main.tsx      ← Has ErrorBoundary (this file)
├── child.tsx     ← Throws error, NO ErrorBoundary
└── index.tsx     ← Navigation links`}
        </pre>
      </div>

      <InfoBox title="About This Example" color="amber">
        <p className="text-slate-300 mb-4">
          This parent route has an{" "}
          <code className="px-1 py-0.5 bg-slate-700 rounded text-emerald-400">
            ErrorBoundary
          </code>
          . The child route throws an error but does <strong>not</strong>{" "}
          have its own ErrorBoundary. Click the button below to navigate to the
          child route and see the error bubble up to this parent's
          ErrorBoundary.
        </p>
        <Link
          to="/features/errors/nested/child"
          className="inline-block px-4 py-2 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors"
        >
          Trigger Child Error
        </Link>
      </InfoBox>

      <CodeBlock>
        {`import { HttpError } from "@udibo/juniper";

// routes/features/errors/nested/main.tsx
// Parent route WITH ErrorBoundary
export function ErrorBoundary({ error }) {
  return <div>Parent caught: {error instanceof HttpError && !error.expose ? "Server error" : (error instanceof Error ? error.message : String(error))}</div>;
}

// routes/features/errors/nested/child.tsx
// Child route WITHOUT ErrorBoundary
export default function Child() {
  throw new Error("Child error!");
  return <div>Won't render</div>;
}`}
      </CodeBlock>
    </div>
  );
}
