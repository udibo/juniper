import { Hono } from "hono";
import { logger } from "hono/logger";

import type { AppEnv } from "@udibo/juniper/server";

import { createQueryClient, queryClientContext } from "@/context/query.ts";

const app = new Hono<AppEnv>();

app.use(logger());

app.use(async (c, next) => {
  const context = c.get("context");
  const queryClient = createQueryClient();
  context.set(queryClientContext, queryClient);
  await next();
});

export default app;
