import { createContext } from "react-router";

import type {
  AnyParams,
  MiddlewareFunction,
  RouteLoaderArgs,
  RouteProps,
} from "@udibo/juniper";

export interface NavigationInfo {
  navigatedAt: string;
  path: string;
}

export const navigationInfoContext = createContext<NavigationInfo>();

export const middleware: MiddlewareFunction[] = [
  async ({ context, request }, next) => {
    const navigationInfo: NavigationInfo = {
      navigatedAt: new Date().toISOString(),
      path: new URL(request.url).pathname,
    };
    context.set(navigationInfoContext, navigationInfo);
    console.log(`[Client Middleware] Navigation to: ${navigationInfo.path}`);
    await next();
  },
];

export interface LoaderData {
  navigationInfo: NavigationInfo;
  serverTime: string;
  message: string;
}

export function loader(
  { context, serverLoader }: RouteLoaderArgs<AnyParams, LoaderData>,
): LoaderData | Promise<LoaderData> {
  let navigationInfo: NavigationInfo | undefined;
  try {
    navigationInfo = context.get(navigationInfoContext);
  } catch {
    // Context not set (SSR or initial load) - fall back to server loader
  }
  if (!navigationInfo) {
    return serverLoader() as Promise<LoaderData>;
  }
  return {
    navigationInfo,
    serverTime: new Date().toISOString(),
    message: "Data loaded with context from client middleware!",
  };
}

export default function ClientMiddlewareExample({
  loaderData,
  context,
}: RouteProps<Record<string, string>, LoaderData>) {
  const { navigationInfo, serverTime, message } = loaderData;
  let liveNavigationInfo: NavigationInfo | undefined;
  try {
    liveNavigationInfo = context.get(navigationInfoContext);
  } catch {
    // Context not set during SSR or initial load
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">
        Client Middleware
      </h2>
      <p className="text-slate-300">
        This example demonstrates client-side middleware that runs during
        client-side navigation. The middleware can set context values that are
        available to loaders and components.
      </p>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <p className="text-emerald-400">{message}</p>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          Navigation Info{" "}
          <span
            className={liveNavigationInfo
              ? "text-emerald-400"
              : "text-blue-400"}
          >
            ({liveNavigationInfo ? "from client middleware" : "from server"})
          </span>
        </h4>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-slate-400">Navigated At:</dt>
            <dd
              className={`font-mono ${
                liveNavigationInfo ? "text-emerald-400" : "text-blue-400"
              }`}
            >
              {navigationInfo?.navigatedAt}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">Path:</dt>
            <dd
              className={`font-mono ${
                liveNavigationInfo ? "text-emerald-400" : "text-blue-400"
              }`}
            >
              {navigationInfo?.path}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">Server Time:</dt>
            <dd
              className={`font-mono ${
                liveNavigationInfo ? "text-emerald-400" : "text-blue-400"
              }`}
            >
              {serverTime}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          Live Context (from component props)
        </h4>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-slate-400">Context Available:</dt>
            <dd className="text-emerald-400 font-mono">
              {liveNavigationInfo ? "Yes" : "No (initial load)"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-yellow-400 mb-2">
          Note
        </h4>
        <p className="text-sm text-yellow-300/80">
          Client middleware only runs during client-side navigations, not during
          the initial server-side render. The loader can fall back to the server
          loader when the context is not set.
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          How it works
        </h4>
        <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
          <li>
            Export a <code className="text-emerald-400">middleware</code>{" "}
            array from your route file
          </li>
          <li>
            Each middleware receives{" "}
            <code className="text-emerald-400">context</code>,{" "}
            <code className="text-emerald-400">request</code>,{" "}
            <code className="text-emerald-400">params</code>, and{" "}
            <code className="text-emerald-400">next</code>
          </li>
          <li>
            Set context values using{" "}
            <code className="text-emerald-400">context.set()</code>
          </li>
          <li>
            Call <code className="text-emerald-400">await next()</code>{" "}
            to continue to child routes
          </li>
          <li>
            Access context in loaders and components via{" "}
            <code className="text-emerald-400">context.get()</code>
          </li>
        </ol>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          Example Code
        </h4>
        <pre className="text-sm text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap">
{`import { createContext } from "react-router";
import type { MiddlewareFunction } from "@udibo/juniper";

export const myContext = createContext<MyData>();

export const middleware: MiddlewareFunction[] = [
  async ({ context, request }, next) => {
    context.set(myContext, { /* your data */ });
    await next();
  },
];

export function loader({ context }) {
  const data = context.get(myContext);
  return { data };
}

export default function MyRoute({ context }) {
  const data = context.get(myContext);
  return <div>{data}</div>;
}`}
        </pre>
      </div>
    </div>
  );
}
