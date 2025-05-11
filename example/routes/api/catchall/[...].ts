import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  const splat = c.req.param("*") ?? "";
  return c.json({ splat });
});

export default app;
