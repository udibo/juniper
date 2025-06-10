import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());

app.get("/", (c) => c.text("Hello, World!"));
app.get("/kill", (c) => {
  queueMicrotask(() => {
    Deno.exit(0);
  });
  return c.text("Killing server...");
});

export default app;
