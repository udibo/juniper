import { CodeBlock } from "@/components/CodeBlock.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";

export default function ServerMiddlewareErrorDemo() {
  return (
    <div>
      <title>Server Middleware Error - Juniper Features</title>
      <FeatureBadge color="red">Server Middleware Error</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Server Middleware Error
      </h2>
      <p className="text-slate-300 mb-6 leading-relaxed">
        This page demonstrates error handling when{" "}
        <code className="px-2 py-1 bg-slate-700 rounded text-emerald-400">
          server middleware
        </code>{" "}
        throws an error. Middleware runs before loaders, so errors here prevent
        the loader from executing.
      </p>

      <InfoBox title="How to Trigger" color="amber" className="mb-6">
        <p className="text-slate-300 mb-4">
          This page's server middleware always throws an HttpError. If you're
          seeing this content, it means you navigated here client-side without a
          loader triggering the server. Click the button below to refresh and
          trigger the middleware error.
        </p>
        <button
          type="button"
          onClick={() => globalThis.location.reload()}
          className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg transition-colors"
        >
          Refresh Page (Trigger Middleware Error)
        </button>
      </InfoBox>

      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700 mb-6">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">
          How It Works
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-slate-300">
          <li>
            Server middleware is defined by exporting a Hono app from a{" "}
            <code className="px-1 py-0.5 bg-slate-700 rounded text-emerald-400">
              .ts
            </code>{" "}
            file
          </li>
          <li>Middleware runs before React Router loaders and actions</li>
          <li>
            Errors in middleware are converted to{" "}
            <code className="px-1 py-0.5 bg-slate-700 rounded text-emerald-400">
              HttpError
            </code>{" "}
            and caught by ErrorBoundary
          </li>
          <li>
            Hono's{" "}
            <code className="px-1 py-0.5 bg-slate-700 rounded text-emerald-400">
              HTTPException
            </code>{" "}
            is also handled (e.g., from basicAuth)
          </li>
        </ol>
      </div>

      <CodeBlock>
        {`// routes/features/errors/server-middleware.ts
import { Hono } from "hono";
import { HttpError } from "@udibo/juniper";
import type { AppEnv } from "@udibo/juniper/server";

const app = new Hono<AppEnv>();

app.use(async (_c, _next) => {
  // Simulate a middleware error (e.g., auth failure)
  throw new HttpError(403, "Access denied by middleware");
});

export default app;

// routes/features/errors/server-middleware.tsx
export default function Page() {
  // Won't render if middleware fails
  return <div>Middleware passed!</div>;
}`}
      </CodeBlock>
    </div>
  );
}


