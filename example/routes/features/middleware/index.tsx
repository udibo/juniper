import { Link } from "react-router";

export default function MiddlewareIndex() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">Middleware</h2>
      <p className="text-slate-300">
        Juniper supports both server-side middleware (using Hono) and
        client-side middleware (using React Router's middleware API). This
        allows you to add authentication, logging, rate limiting, and other
        cross-cutting concerns to your routes.
      </p>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-200">
          Server Middleware Examples
        </h3>
        <ul className="space-y-2">
          <li>
            <Link
              to="/features/middleware/logging"
              className="text-emerald-400 hover:text-emerald-300"
            >
              Logging Middleware
            </Link>
            {" - "}
            <span className="text-slate-400">
              Add request/response logging to routes
            </span>
          </li>
          <li>
            <Link
              to="/features/middleware/basic-auth"
              className="text-emerald-400 hover:text-emerald-300"
            >
              Basic Auth Middleware
            </Link>
            {" - "}
            <span className="text-slate-400">
              Protect routes with HTTP Basic Authentication
            </span>
          </li>
          <li>
            <Link
              to="/features/middleware/context-sharing"
              className="text-emerald-400 hover:text-emerald-300"
            >
              Context Sharing
            </Link>
            {" - "}
            <span className="text-slate-400">
              Share data between middleware and loaders
            </span>
          </li>
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-200">
          Client Middleware Examples
        </h3>
        <ul className="space-y-2">
          <li>
            <Link
              to="/features/middleware/client-middleware"
              className="text-emerald-400 hover:text-emerald-300"
            >
              Client Middleware
            </Link>
            {" - "}
            <span className="text-slate-400">
              Run middleware during client-side navigation
            </span>
          </li>
          <li>
            <Link
              to="/features/middleware/client-redirect"
              className="text-emerald-400 hover:text-emerald-300"
            >
              Client Redirect
            </Link>
            {" - "}
            <span className="text-slate-400">
              Redirect from middleware by throwing a redirect
            </span>
          </li>
          <li>
            <Link
              to="/features/middleware/combined"
              className="text-emerald-400 hover:text-emerald-300"
            >
              Combined Middleware
            </Link>
            {" - "}
            <span className="text-slate-400">
              Use both server and client middleware on the same route
            </span>
          </li>
        </ul>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          How it works
        </h4>
        <p className="text-sm text-slate-400">
          Create a <code className="text-emerald-400">.ts</code>{" "}
          file alongside your route{" "}
          <code className="text-emerald-400">.tsx</code>{" "}
          file and export a Hono app as the default export. The middleware will
          run before the React route handlers.
        </p>
      </div>
    </div>
  );
}
