export default function LoggingMiddlewareExample() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">Logging Middleware</h2>
      <p className="text-slate-300">
        This page has server-side logging middleware. The logging only occurs
        when the route is rendered on the server (initial page load or refresh).
        Client-side navigation does not trigger server middleware.
      </p>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-amber-400 mb-2">Note</h4>
        <p className="text-sm text-slate-400">
          Since the root route (<code className="text-emerald-400">
            main.ts
          </code>
          ) already has logger middleware, requests to this endpoint will log
          twice - once from the root middleware and once from this route's
          middleware.
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          Server Output (on page refresh)
        </h4>
        <pre className="text-sm text-slate-400 font-mono">
{`<-- GET /features/middleware/logging
--> GET /features/middleware/logging 200 16ms`}
        </pre>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          logging.ts
        </h4>
        <pre className="text-sm text-emerald-400 font-mono overflow-x-auto">
{`import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();
app.use(logger());

export default app;`}
        </pre>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          When does middleware run?
        </h4>
        <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
          <li>
            <span className="text-emerald-400">✓</span> Initial page load (SSR)
          </li>
          <li>
            <span className="text-emerald-400">✓</span> Page refresh
          </li>
          <li>
            <span className="text-emerald-400">✓</span>{" "}
            Server loader/action requests
          </li>
          <li>
            <span className="text-slate-500">✗</span>{" "}
            Client-side navigation (no server request)
          </li>
        </ul>
      </div>
    </div>
  );
}
