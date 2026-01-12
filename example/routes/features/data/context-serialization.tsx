import type { AnyParams, RouteLoaderArgs, RouteProps } from "@udibo/juniper";

import { CodeBlock } from "@/components/CodeBlock.tsx";
import { DataList, DataListItem } from "@/components/DataList.tsx";
import { FeatureBadge } from "@/components/FeatureBadge.tsx";
import { InfoBox } from "@/components/InfoBox.tsx";
import { Note } from "@/components/Note.tsx";

import {
  type ServerSession,
  serverSessionContext,
} from "@/context/server-session.ts";

export function loader({ context }: RouteLoaderArgs) {
  return context.get(serverSessionContext);
}

export default function ContextSerializationDemo(
  { loaderData }: RouteProps<AnyParams, ServerSession>,
) {
  const serverSession = loaderData;

  return (
    <div>
      <title>Context Serialization - Juniper Features</title>
      <FeatureBadge color="purple">Context Serialization</FeatureBadge>
      <h2 className="text-2xl font-bold text-slate-100 mb-4">
        Context Serialization
      </h2>

      <p className="text-slate-300 mb-6 leading-relaxed">
        Context serialization allows server-side context values to be
        transferred to the client during hydration. This enables the client to
        access data that was set by server middleware without making additional
        requests.
      </p>

      <InfoBox
        title="When to Use Context Serialization"
        color="purple"
        className="mb-6"
      >
        <ul className="list-disc list-inside space-y-2 text-slate-300">
          <li>Sharing user session data across server and client</li>
          <li>Passing configuration set during SSR to the client</li>
          <li>Hydrating client-side state managers (e.g., TanStack Query)</li>
          <li>Avoiding duplicate data fetching on initial page load</li>
        </ul>
      </InfoBox>

      <InfoBox title="Server Session Data" color="blue" className="mb-6">
        <p className="text-slate-400 text-sm mb-3">
          This data was set by server middleware and serialized to the client:
        </p>
        <DataList>
          <DataListItem label="Session ID">
            <span className="font-mono text-sm text-purple-400">
              {serverSession.sessionId}
            </span>
          </DataListItem>
          <DataListItem label="Server Timestamp">
            <span className="font-mono text-sm">
              {serverSession.serverTimestamp}
            </span>
          </DataListItem>
          <DataListItem label="Server PID" isLast>
            <span className="font-mono text-sm text-purple-400">
              {serverSession.serverPid}
            </span>
          </DataListItem>
        </DataList>
      </InfoBox>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-200">How It Works</h3>

        <CodeBlock title="1. Create and register context (context/server-session.ts)">
          {`import { createContext } from "react-router";
import { registerContext } from "@udibo/juniper";

export interface ServerSession {
  sessionId: string;
  serverTimestamp: string;
  serverPid: number;
}

export const serverSessionContext = createContext<ServerSession>();

export function createServerSession(): ServerSession {
  return {
    sessionId: crypto.randomUUID().slice(0, 8),
    serverTimestamp: new Date().toISOString(),
    serverPid: Deno.pid,
  };
}

// Register serialization for this context
registerContext<ServerSession>({
  name: "serverSession",
  context: serverSessionContext,
  serialize: (session) => session,
  deserialize: (data) => data as ServerSession,
});`}
        </CodeBlock>

        <CodeBlock title="2. Set context in server middleware (routes/main.ts)">
          {`import { Hono } from "hono";
import type { AppEnv } from "@udibo/juniper/server";
import {
  createServerSession,
  serverSessionContext,
} from "@/context/server-session.ts";

const app = new Hono<AppEnv>();

// Set server session in context for all routes
app.use(async (c, next) => {
  const context = c.get("context");
  context.set(serverSessionContext, createServerSession());
  await next();
});

export default app;`}
        </CodeBlock>

        <CodeBlock title="3. Access context in loaders (routes/my-route.tsx)">
          {`import type { AnyParams, RouteLoaderArgs, RouteProps } from "@udibo/juniper";
import { serverSessionContext } from "@/context/server-session.ts";
import type { ServerSession } from "@/context/server-session.ts";

// Loaders run on both server (SSR) and client (navigation)
export function loader({ context }: RouteLoaderArgs) {
  return context.get(serverSessionContext);
}

export default function MyRoute({ loaderData }: RouteProps<AnyParams, ServerSession>) {
  return <p>Session ID: {loaderData.sessionId}</p>;
}`}
        </CodeBlock>

        <CodeBlock title="4. Browser-only code in loaders (optional)">
          {`import type { RouteLoaderArgs } from "@udibo/juniper";
import { isBrowser } from "@udibo/juniper/utils/env";

export function loader({ context }: RouteLoaderArgs) {
  const data = context.get(myContext);

  // Use isBrowser() for browser-only APIs
  if (isBrowser()) {
    // This only runs on client-side navigation, not during SSR
    localStorage.setItem("lastVisited", new Date().toISOString());
  }

  return data;
}`}
        </CodeBlock>
      </div>

      <Note className="mt-6">
        The server session data shown above was set during SSR and transferred
        to the client via context serialization. The client can access this data
        immediately without making any additional requests.
      </Note>
    </div>
  );
}
