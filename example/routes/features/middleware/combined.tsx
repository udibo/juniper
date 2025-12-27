import { createContext } from "react-router";

import type {
  MiddlewareFunction,
  RouteLoaderArgs,
  RouteProps,
} from "@udibo/juniper";

// Contexts for sharing data
export interface ServerRequestInfo {
  requestId: string;
  serverTimestamp: string;
  userAgent: string;
}

export interface ClientNavigationInfo {
  navigatedAt: string;
  clientTimestamp: string;
  isClientNavigation: boolean;
}

export const serverRequestInfoContext = createContext<ServerRequestInfo>();
export const clientNavigationInfoContext = createContext<
  ClientNavigationInfo
>();

// Client middleware - runs during client-side navigation
export const middleware: MiddlewareFunction[] = [
  async ({ context }, next) => {
    const clientInfo: ClientNavigationInfo = {
      navigatedAt: new Date().toISOString(),
      clientTimestamp: new Date().toISOString(),
      isClientNavigation: true,
    };
    context.set(clientNavigationInfoContext, clientInfo);
    console.log(
      `[Client Middleware] Navigation at: ${clientInfo.navigatedAt}`,
    );
    await next();
  },
];

export interface LoaderData {
  serverInfo: ServerRequestInfo | null;
  clientInfo: ClientNavigationInfo | null;
  loadedAt: string;
  source: "server" | "client";
}

export function loader(
  { context, serverLoader }: RouteLoaderArgs,
): LoaderData | Promise<LoaderData> {
  // Check if we have client navigation info (means we're doing client-side navigation)
  let clientInfo: ClientNavigationInfo | undefined;
  try {
    clientInfo = context.get(clientNavigationInfoContext);
  } catch {
    // Context not set yet (SSR or initial load)
  }

  if (!clientInfo) {
    // Initial SSR - call server loader
    return serverLoader() as Promise<LoaderData>;
  }

  // Client-side navigation - we have client middleware context
  // Also get server info if it was set during SSR
  let serverInfo: ServerRequestInfo | undefined;
  try {
    serverInfo = context.get(serverRequestInfoContext);
  } catch {
    // Server context not available on client
  }

  return {
    serverInfo: serverInfo ?? null,
    clientInfo,
    loadedAt: new Date().toISOString(),
    source: "client",
  };
}

export default function CombinedMiddlewareExample({
  loaderData,
  context,
}: RouteProps<Record<string, string>, LoaderData>) {
  const { serverInfo, clientInfo, loadedAt, source } = loaderData;

  // Get live context values from props (may not be set during SSR/initial load)
  let liveServerInfo: ServerRequestInfo | undefined;
  let liveClientInfo: ClientNavigationInfo | undefined;
  try {
    liveServerInfo = context.get(serverRequestInfoContext);
  } catch {
    // Not set
  }
  try {
    liveClientInfo = context.get(clientNavigationInfoContext);
  } catch {
    // Not set
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">
        Combined Server + Client Middleware
      </h2>
      <p className="text-slate-300">
        This example demonstrates using both server-side (Hono) and client-side
        (React Router) middleware on the same route. Each type of middleware
        runs at different times and can set context values.
      </p>

      <div
        className={`border rounded-lg p-4 ${
          source === "server"
            ? "bg-blue-500/10 border-blue-500/30"
            : "bg-emerald-500/10 border-emerald-500/30"
        }`}
      >
        <p
          className={source === "server" ? "text-blue-400" : "text-emerald-400"}
        >
          Data loaded from: <strong>{source}</strong> at {loadedAt}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <h4 className="text-sm font-semibold text-blue-400 mb-3">
            🖥️ Server Middleware Info
          </h4>
          {serverInfo
            ? (
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-slate-400">Request ID:</dt>
                  <dd className="text-blue-400 font-mono text-xs">
                    {serverInfo.requestId}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400">Server Time:</dt>
                  <dd className="text-blue-400 font-mono text-xs">
                    {serverInfo.serverTimestamp}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400">User Agent:</dt>
                  <dd className="text-blue-400 font-mono text-xs break-all">
                    {serverInfo.userAgent}
                  </dd>
                </div>
              </dl>
            )
            : (
              <p className="text-slate-500 text-sm italic">
                Not available (client-side navigation)
              </p>
            )}
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
          <h4 className="text-sm font-semibold text-emerald-400 mb-3">
            🌐 Client Middleware Info
          </h4>
          {clientInfo
            ? (
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-slate-400">Navigated At:</dt>
                  <dd className="text-emerald-400 font-mono text-xs">
                    {clientInfo.navigatedAt}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400">Client Time:</dt>
                  <dd className="text-emerald-400 font-mono text-xs">
                    {clientInfo.clientTimestamp}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-400">Is Client Nav:</dt>
                  <dd className="text-emerald-400 font-mono">
                    {clientInfo.isClientNavigation ? "Yes" : "No"}
                  </dd>
                </div>
              </dl>
            )
            : (
              <p className="text-slate-500 text-sm italic">
                Not available (SSR or initial load)
              </p>
            )}
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          📊 Live Context (from component props)
        </h4>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Server context available:</span>
            <span
              className={liveServerInfo ? "text-blue-400" : "text-slate-500"}
            >
              {liveServerInfo ? "Yes" : "No"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Client context available:</span>
            <span
              className={liveClientInfo ? "text-emerald-400" : "text-slate-500"}
            >
              {liveClientInfo ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-yellow-400 mb-2">
          💡 When Each Middleware Runs
        </h4>
        <ul className="text-sm text-yellow-300/80 space-y-1 list-disc list-inside">
          <li>
            <strong>Server middleware (Hono):</strong>{" "}
            Runs on every HTTP request to the server
          </li>
          <li>
            <strong>Client middleware (React Router):</strong>{" "}
            Runs during client-side navigation only
          </li>
          <li>
            <strong>Initial page load:</strong> Only server middleware runs
          </li>
          <li>
            <strong>Client navigation:</strong> Only client middleware runs
          </li>
        </ul>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          How it works
        </h4>
        <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
          <li>
            Create a <code className="text-blue-400">.ts</code>{" "}
            file with Hono middleware for server-side
          </li>
          <li>
            Export a <code className="text-emerald-400">middleware</code>{" "}
            array in your <code className="text-emerald-400">.tsx</code>{" "}
            file for client-side
          </li>
          <li>
            Both can set values on the{" "}
            <code className="text-purple-400">context</code> object
          </li>
          <li>
            The loader checks which context values are available to determine
            the source
          </li>
          <li>
            Components receive <code className="text-purple-400">context</code>
            {" "}
            as a prop for direct access
          </li>
        </ol>
      </div>
    </div>
  );
}
