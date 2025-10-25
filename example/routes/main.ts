import { Hono } from "hono";
import { logger } from "hono/logger";
import { isProduction } from "@udibo/juniper/utils/env";

import { CustomError, SerializedCustomError } from "/utils/error.ts";

const app = new Hono();

app.use(logger());

if (!isProduction()) {
  app.get("/kill", (c) => {
    queueMicrotask(() => {
      Deno.exit(0);
    });
    return c.text("Killing server...");
  });
}

export default app;

export function serializeError(error: unknown) {
  if (error instanceof CustomError) {
    return {
      __type: "Error",
      __subType: "CustomError",
      message: error.message,
      exposeStack: error.exposeStack,
      stack: error.stack,
    } satisfies SerializedCustomError;
  }
}
