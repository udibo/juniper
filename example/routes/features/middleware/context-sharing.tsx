import { createContext } from "react-router";

import type { RouteProps } from "@udibo/juniper";

export interface RequestInfo {
  requestId: string;
  timestamp: string;
  userAgent: string;
}

export const requestInfoContext = createContext<RequestInfo>();

export interface LoaderData {
  requestInfo: RequestInfo;
  message: string;
}

export default function ContextSharingExample({
  loaderData,
}: RouteProps<Record<string, string>, LoaderData>) {
  const { requestInfo, message } = loaderData;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100">
        Context Sharing Middleware
      </h2>
      <p className="text-slate-300">
        This example demonstrates how server-side middleware can share data with
        loaders using React Router's context system.
      </p>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <p className="text-emerald-400">{message}</p>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          Request Info (set by middleware, read by loader)
        </h4>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-slate-400">Request ID:</dt>
            <dd className="text-emerald-400 font-mono">
              {requestInfo.requestId}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">Timestamp:</dt>
            <dd className="text-emerald-400 font-mono">
              {requestInfo.timestamp}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">User Agent:</dt>
            <dd className="text-emerald-400 font-mono text-xs break-all">
              {requestInfo.userAgent}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          How it works
        </h4>
        <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
          <li>
            Create a context with{" "}
            <code className="text-emerald-400">createContext()</code>{" "}
            from react-router
          </li>
          <li>
            In middleware, get the router context via{" "}
            <code className="text-emerald-400">c.get("context")</code>
          </li>
          <li>
            Set data using{" "}
            <code className="text-emerald-400">
              context.set(yourContext, value)
            </code>
          </li>
          <li>
            In loaders, read data using{" "}
            <code className="text-emerald-400">context.get(yourContext)</code>
          </li>
        </ol>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          context-sharing.tsx (context definition)
        </h4>
        <pre className="text-sm text-emerald-400 font-mono overflow-x-auto">
{`import { createContext } from "react-router";

export interface RequestInfo {
  requestId: string;
  timestamp: string;
  userAgent: string;
}

export const requestInfoContext =
  createContext<RequestInfo>();`}
        </pre>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">
          context-sharing.ts (middleware + loader)
        </h4>
        <pre className="text-sm text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap">
{`import { Hono } from "hono";
import type { AppEnv } from "@udibo/juniper/server";
import {
  requestInfoContext,
  type RequestInfo,
} from "./context-sharing.tsx";

const app = new Hono<AppEnv>();

app.use(async (c, next) => {
  const context = c.get("context");

  const requestInfo: RequestInfo = {
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userAgent: c.req.header("user-agent"),
  };

  context.set(requestInfoContext, requestInfo);
  await next();
});

export default app;

export async function loader({ context }) {
  const requestInfo = context.get(requestInfoContext);
  return { requestInfo };
}`}
        </pre>
      </div>
    </div>
  );
}
