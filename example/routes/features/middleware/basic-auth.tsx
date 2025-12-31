import { HttpError } from "@udibo/juniper";
import type { ErrorBoundaryProps, RouteProps } from "@udibo/juniper";

export interface LoaderData {
  authenticatedAt: string;
}

export default function BasicAuthMiddlewareExample({
  loaderData,
}: RouteProps<Record<string, string>, LoaderData>) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">
        Basic Auth Middleware
      </h2>
      <p className="text-slate-300">
        This page is protected with HTTP Basic Authentication. If you're seeing
        this page, you've successfully authenticated!
      </p>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <p className="text-emerald-400">
          ✓ Authentication successful
        </p>
        <p className="text-sm text-slate-400 mt-1">
          Authenticated at: {loaderData.authenticatedAt}
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          Credentials
        </h4>
        <ul className="text-sm text-slate-400 space-y-1">
          <li>
            Username: <code className="text-emerald-400">admin</code>
          </li>
          <li>
            Password: <code className="text-emerald-400">password</code>
          </li>
        </ul>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          basic-auth.ts
        </h4>
        <pre className="text-sm text-emerald-400 font-mono overflow-x-auto">
{`import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

const app = new Hono();
app.use(basicAuth({
  username: "admin",
  password: "password",
}));

export default app;

export async function loader() {
  return { authenticatedAt: new Date().toISOString() };
}`}
        </pre>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-amber-400 mb-2">
          Why the loader matters
        </h4>
        <p className="text-sm text-slate-400">
          The loader ensures that a server request is made when navigating to
          this page, even via client-side navigation. Without a loader,
          client-side navigation would render the page without hitting the
          server middleware, bypassing authentication.
        </p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-amber-400 mb-2">
          Error Handling
        </h4>
        <p className="text-sm text-slate-400">
          When authentication fails, Hono's basicAuth middleware throws an
          HTTPException with a 401 status. Juniper converts this to an HttpError
          and renders an error page. The browser's native auth dialog appears
          because the response includes the{" "}
          <code className="text-emerald-400">WWW-Authenticate</code> header.
        </p>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">
        Basic Auth Middleware
      </h2>

      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-red-400 mb-2">
          Authentication Failed
        </h4>
        <p className="text-red-300 font-mono text-sm mb-4">
          {error instanceof HttpError
            ? error.exposedMessage
            : (error instanceof Error ? error.message : String(error))}
        </p>
        <p className="text-sm text-slate-400">
          The browser should display an authentication dialog. If you dismissed
          it, refresh the page to try again.
        </p>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-emerald-400 mb-2">
          Hint: Try these credentials
        </h4>
        <ul className="text-sm text-slate-300 space-y-1">
          <li>
            Username: <code className="text-emerald-400">admin</code>
          </li>
          <li>
            Password: <code className="text-emerald-400">password</code>
          </li>
        </ul>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          How it works
        </h4>
        <p className="text-sm text-slate-400">
          When authentication fails, Hono's basicAuth middleware throws an
          HTTPException with a 401 status and a{" "}
          <code className="text-emerald-400">WWW-Authenticate</code>{" "}
          header. Juniper converts this to an HttpError, preserving the headers,
          and renders this error boundary.
        </p>
      </div>
    </div>
  );
}
