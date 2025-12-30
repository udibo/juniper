import { Hono } from "hono";
import { logger } from "hono/logger";
import type { RouterContextProvider } from "react-router";
import { isProduction } from "@udibo/juniper/utils/env";
import type { AppEnv } from "@udibo/juniper/server";

import {
  createServerSession,
  serverSessionContext,
} from "@/context/server-session.ts";
import type { SerializedContext } from "./main.tsx";

const app = new Hono<AppEnv>();

app.use(logger());

app.use(async (c, next) => {
  const context = c.get("context");
  context.set(serverSessionContext, createServerSession());
  await next();
});

if (!isProduction()) {
  app.get("/kill", (c) => {
    queueMicrotask(() => {
      Deno.exit(0);
    });
    return c.text("Killing server...");
  });
}

export function serializeContext(
  context: RouterContextProvider,
): SerializedContext {
  const serializedContext: SerializedContext = {};

  try {
    const serverSession = context.get(serverSessionContext);
    serializedContext.serverSession = serverSession;
  } catch {
    // serverSession not set in context
  }

  return serializedContext;
}

export default app;
