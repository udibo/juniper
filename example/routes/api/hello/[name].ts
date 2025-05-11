import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  const name = c.req.param("name");
  return c.json({ message: `Hello, ${name}!` });
});

export default app;
