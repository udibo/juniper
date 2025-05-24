import { Hono } from "hono";

import type { NewPost, Post, PostPatch } from "/services/post.ts";
import { postService } from "/services/post.ts";

const app = new Hono();

app.get("/", async (c) => {
  const queryParams = c.req.query();
  const options = postService.parseListQueryParams(queryParams);

  const { entries: posts, cursor } = await postService.list(options);
  return c.json({ posts, cursor });
});

app.post("/", async (c) => {
  const newPost = await c.req.json<NewPost>();
  const post = await postService.create(newPost);
  return c.json(post, 201);
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const post = await postService.get(id);
  return c.json(post);
});

app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const postUpdate = await c.req.json<Post>();
  const post = await postService.update({ ...postUpdate, id });
  return c.json(post);
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const postPatch = await c.req.json<PostPatch>();
  const post = await postService.patch({ ...postPatch, id });
  return c.json(post);
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await postService.delete(id);
  return c.json({ deleted: true });
});

export default app;
