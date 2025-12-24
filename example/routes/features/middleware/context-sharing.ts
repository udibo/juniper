import { Hono } from "hono";

import type { AppEnv } from "@udibo/juniper/server";
import type { RouteLoaderArgs } from "@udibo/juniper";

import { requestInfoContext } from "./context-sharing.tsx";
import type { LoaderData, RequestInfo } from "./context-sharing.tsx";

const app = new Hono<AppEnv>();

app.use(async (c, next) => {
  const context = c.get("context");

  const requestInfo: RequestInfo = {
    requestId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userAgent: c.req.header("user-agent") ?? "unknown",
  };

  context.set(requestInfoContext, requestInfo);

  console.log(`[Middleware] Set request info: ${requestInfo.requestId}`);

  await next();
});

export default app;

export function loader({ context }: RouteLoaderArgs): LoaderData {
  const requestInfo = context.get(requestInfoContext);
  console.log(`[Loader] Got request info: ${requestInfo.requestId}`);
  return {
    requestInfo,
    message: "Data loaded successfully with context from middleware!",
  };
}
