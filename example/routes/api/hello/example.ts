import { Hono } from "hono";

const app = new Hono();

app.get(
  "/",
  (c) =>
    c.json({
      message:
        "This is an example of a named route in the same directory as a dynamic route.",
    }),
);

export default app;
