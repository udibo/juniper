import { redirect, useLocation } from "react-router";

import type { MiddlewareFunction, RouteProps } from "@udibo/juniper";

export const middleware: MiddlewareFunction[] = [
  async ({ request }, next) => {
    const url = new URL(request.url);
    const allowed = url.searchParams.get("allowed") === "true";

    console.log(
      `[Client Redirect Middleware] Checking access: allowed=${allowed}`,
    );

    if (!allowed) {
      throw redirect(
        "/features/middleware/client-redirect?allowed=true&redirected=true",
      );
    }

    await next();
  },
];

export default function ClientRedirectExample({}: RouteProps) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const wasRedirected = searchParams.get("redirected") === "true";

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">
        Client Middleware Redirect
      </h2>
      <p className="text-slate-300">
        This example demonstrates how client middleware can redirect by throwing
        a{" "}
        <code className="text-emerald-400">redirect()</code>. The middleware
        checks for an <code className="text-emerald-400">allowed=true</code>
        {" "}
        query parameter and redirects if it's missing.
      </p>

      {wasRedirected && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-400">
            ⚡ You were redirected by client middleware! The middleware detected
            that <code className="text-yellow-300">allowed=true</code>{" "}
            was missing and redirected you here.
          </p>
        </div>
      )}

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <p className="text-emerald-400">
          ✅ Access granted! You have the required{" "}
          <code className="text-emerald-300">allowed=true</code> parameter.
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          Try It Out
        </h4>
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Click the link below to navigate without the required parameter. The
            client middleware will intercept and redirect you back with the
            correct parameter.
          </p>
          <a
            href="/features/middleware/client-redirect"
            className="inline-block px-4 py-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Navigate without allowed=true →
          </a>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          How it works
        </h4>
        <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
          <li>
            Middleware checks for{" "}
            <code className="text-emerald-400">allowed=true</code> in the URL
          </li>
          <li>
            If missing, it throws{" "}
            <code className="text-emerald-400">
              redirect("/path?allowed=true")
            </code>
          </li>
          <li>React Router intercepts the redirect and navigates</li>
          <li>The middleware runs again, this time allowing access</li>
        </ol>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          Example Code
        </h4>
        <pre className="text-sm text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap">
          {`import { redirect } from "react-router";
import type { MiddlewareFunction } from "@udibo/juniper";

export const middleware: MiddlewareFunction[] = [
  async ({ request }, next) => {
    const url = new URL(request.url);
    const isAuthenticated = checkAuth(); // Your auth logic

    if (!isAuthenticated) {
      throw redirect("/login");
    }

    await next();
  },
];`}
        </pre>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-yellow-400 mb-2">
          Note
        </h4>
        <p className="text-sm text-yellow-300/80">
          Client middleware redirects only work during client-side navigation.
          For server-side redirects (initial page load), use server middleware
          (Hono) instead.
        </p>
      </div>
    </div>
  );
}
