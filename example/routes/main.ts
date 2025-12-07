import { Hono } from "hono";
import { logger } from "hono/logger";
import { isProduction } from "@udibo/juniper/utils/env";

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
