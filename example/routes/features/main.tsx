import type { ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router";

interface FeatureGroup {
  title: string;
  features: { name: string; path: string }[];
}

const featureGroups: FeatureGroup[] = [
  {
    title: "Routing",
    features: [
      { name: "Index Route", path: "/features/routing" },
      { name: "Parameterized Route", path: "/features/routing/post/abc123" },
      { name: "Nested Params", path: "/features/routing/user/u42/profile" },
      { name: "Wildcard Route", path: "/features/routing/files/docs/api/ref" },
      { name: "Prefix Route", path: "/features/routing/settings/appearance" },
    ],
  },
  {
    title: "Data Loading",
    features: [
      { name: "Client Loader", path: "/features/data/loader" },
      { name: "Deferred Data", path: "/features/data/deferred" },
      { name: "Hydrate Fallback", path: "/features/data/hydrate-fallback" },
      { name: "Parent Route Data", path: "/features/data/parent-data" },
    ],
  },
  {
    title: "Server Loaders",
    features: [
      { name: "Return Object", path: "/features/data/server-loaders/object" },
      {
        name: "Throw Redirect",
        path: "/features/data/server-loaders/redirect",
      },
      {
        name: "Return Response",
        path: "/features/data/server-loaders/response",
      },
      {
        name: "Client Calls Server",
        path: "/features/data/server-loaders/client-calls-server",
      },
    ],
  },
  {
    title: "Actions",
    features: [
      { name: "Form Action", path: "/features/data/action" },
      { name: "Fetcher Action", path: "/features/data/fetcher" },
    ],
  },
  {
    title: "Server Actions",
    features: [
      { name: "Return Object", path: "/features/data/server-actions/object" },
      {
        name: "Throw Redirect",
        path: "/features/data/server-actions/redirect",
      },
      {
        name: "Return Response",
        path: "/features/data/server-actions/response",
      },
      {
        name: "Client Calls Server",
        path: "/features/data/server-actions/client-calls-server",
      },
    ],
  },
  {
    title: "Server Middleware",
    features: [
      { name: "Logging", path: "/features/middleware/logging" },
      { name: "Basic Auth", path: "/features/middleware/basic-auth" },
      { name: "Context Sharing", path: "/features/middleware/context-sharing" },
    ],
  },
  {
    title: "Client Middleware",
    features: [
      {
        name: "Client Middleware",
        path: "/features/middleware/client-middleware",
      },
      {
        name: "Client Redirect",
        path: "/features/middleware/client-redirect",
      },
      { name: "Combined Middleware", path: "/features/middleware/combined" },
    ],
  },
  {
    title: "Error Handling",
    features: [
      { name: "Error Boundary", path: "/features/errors/boundary" },
      { name: "SSR Errors", path: "/features/errors/ssr" },
      { name: "Server Loader Error", path: "/features/errors/server-loader" },
      {
        name: "Server Middleware Error",
        path: "/features/errors/server-middleware",
      },
      { name: "Nested Error", path: "/features/errors/nested" },
    ],
  },
];

const allFeaturePaths = featureGroups.flatMap((g) =>
  g.features.map((f) => f.path)
);

function getActiveFeaturePath(pathname: string): string | undefined {
  return allFeaturePaths
    .filter((p) => pathname === p || pathname.startsWith(p + "/"))
    .sort((a, b) => b.length - a.length)[0];
}

function FeaturesLayoutShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const activeFeaturePath = getActiveFeaturePath(location.pathname);

  return (
    <div>
      <header className="border-b border-slate-700/50 pb-6 mb-8">
        <nav className="flex gap-4 items-center">
          <Link
            to="/"
            className="text-slate-400 hover:text-emerald-400 transition-colors"
          >
            ← Home
          </Link>
          <h1 className="text-3xl font-bold text-slate-100 m-0">Features</h1>
        </nav>
      </header>

      <div className="grid lg:grid-cols-[280px_1fr] gap-8">
        <aside className="space-y-6">
          {featureGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.features.map((feature) => {
                  const isActive = feature.path === activeFeaturePath;
                  return (
                    <li key={feature.path}>
                      <Link
                        to={feature.path}
                        className={`block px-3 py-2 rounded-lg transition-colors ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400"
                            : "text-slate-300 hover:text-emerald-400 hover:bg-slate-800/50"
                        }`}
                      >
                        {feature.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        <main className="bg-slate-800/30 rounded-2xl p-8 border border-slate-700/50 min-h-[400px]">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function FeaturesLayout() {
  return (
    <FeaturesLayoutShell>
      <Outlet />
    </FeaturesLayoutShell>
  );
}
