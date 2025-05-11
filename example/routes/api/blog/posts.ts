import { Hono } from "hono";

import { getPost, getPosts } from "/services/posts.ts";

const app = new Hono();

app.get("/", async (c) => {
  return c.json(await getPosts());
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  return c.json(await getPost(id));
});

export default app;
