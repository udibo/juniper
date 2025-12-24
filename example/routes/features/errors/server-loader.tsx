import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";

export default function ServerLoaderErrorDemo() {
  return (
    <div>
      <title>Server Loader Error - Juniper Features</title>
      <FeatureBadge color="red">Server Loader Error</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Server Loader Error
      </h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        This page demonstrates error handling when a{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          server loader
        </code>{" "}
        throws an error. Server loaders run exclusively on the server, so errors
        here are always server-side errors.
      </p>

      <InfoBox title="How to Trigger" color="amber" className="mb-6">
        <p className="text-slate-300 mb-4">
          This page's server loader always throws an HttpError. If you're seeing
          this content, it means you navigated here client-side without
          triggering the server loader. Click the button below to refresh and
          trigger the server loader error.
        </p>
        <button
          type="button"
          onClick={() => globalThis.location.reload()}
          className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors"
        >
          Refresh Page (Trigger Server Loader Error)
        </button>
      </InfoBox>

      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          How It Works
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-slate-300">
          <li>
            Server loaders are defined in{" "}
            <code className="px-1 py-0.5 bg-slate-700 rounded text-emerald-400">
              .ts
            </code>{" "}
            files alongside your route
          </li>
          <li>They run on the server during SSR and data fetching</li>
          <li>
            Errors thrown in server loaders are caught by the nearest
            ErrorBoundary
          </li>
          <li>
            Use{" "}
            <code className="px-1 py-0.5 bg-slate-700 rounded text-emerald-400">
              HttpError
            </code>{" "}
            for typed HTTP errors with status codes
          </li>
        </ol>
      </div>

      <CodeBlock>
        {`// routes/features/errors/server-loader.ts
import { HttpError } from "@udibo/juniper";
import type { RouteLoaderArgs } from "@udibo/juniper";

export function loader(_args: RouteLoaderArgs) {
  // Simulate a server error (e.g., database failure)
  throw new HttpError(500, "Database connection failed");
}

// routes/features/errors/server-loader.tsx
export default function Page() {
  // This component won't render if the loader fails
  return <div>Data loaded!</div>;
}`}
      </CodeBlock>
    </div>
  );
}


