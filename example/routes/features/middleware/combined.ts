import { Hono } from "hono";

import type { AppEnv } from "@udibo/juniper/server";
import type { RouteLoaderArgs } from "@udibo/juniper";

import {
  type LoaderData,
  type ServerRequestInfo,
  serverRequestInfoContext,
} from "./combined.tsx";

const app = new Hono<AppEnv>();

// Server middleware - runs on every HTTP request
app.use(async (c, next) => {
  const context = c.get("context");

  const serverInfo: ServerRequestInfo = {
    requestId: crypto.randomUUID(),
    serverTimestamp: new Date().toISOString(),
    userAgent: c.req.header("user-agent") ?? "unknown",
  };

  context.set(serverRequestInfoContext, serverInfo);
  console.log(
    `[Server Middleware] Request ${serverInfo.requestId} at ${serverInfo.serverTimestamp}`,
  );

  await next();
});

export default app;

// Server loader - called during SSR or when client calls serverLoader()
export function loader(
  { context }: RouteLoaderArgs,
): LoaderData {
  const serverInfo = context.get(serverRequestInfoContext);
  console.log(`[Server Loader] Got request info: ${serverInfo.requestId}`);

  return {
    serverInfo,
    clientInfo: null, // Not available on server
    loadedAt: new Date().toISOString(),
    source: "server",
  };
}
