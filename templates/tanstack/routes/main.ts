import { Hono } from "hono";
import { logger } from "hono/logger";
import { dehydrate } from "@tanstack/react-query";
import type { RouterContextProvider } from "react-router";

import type { AppEnv } from "@udibo/juniper/server";

import { createQueryClient, queryClientContext } from "@/context/query.ts";
import type { SerializedContext } from "./main.tsx";

const app = new Hono<AppEnv>();

app.use(logger());

app.use(async (c, next) => {
  const context = c.get("context");
  const queryClient = createQueryClient();
  context.set(queryClientContext, queryClient);
  await next();
});

export function serializeContext(
  context: RouterContextProvider,
): SerializedContext {
  const serializedContext: SerializedContext = {};

  // Dehydrate QueryClient if available
  try {
    const queryClient = context.get(queryClientContext);
    serializedContext.dehydratedState = dehydrate(queryClient);
  } catch {
    // queryClient not set in context
  }

  return serializedContext;
}

export default app;
