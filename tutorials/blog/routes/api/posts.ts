import { Hono } from "hono";
import { type NewPost, postService } from "@/services/post.ts";

const app = new Hono();

app.get("/", async (c) => {
  const posts = await postService.list();
  return c.json({ data: posts });
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const post = await postService.get(id);
  return c.json({ data: post });
});

app.post("/", async (c) => {
  const body = await c.req.json<NewPost>();

  if (!body.title || body.title.length < 3) {
    return c.json({ error: "Title must be at least 3 characters" }, 400);
  }
  if (!body.content || body.content.length < 10) {
    return c.json({ error: "Content must be at least 10 characters" }, 400);
  }

  const post = await postService.create(body);
  return c.json({ data: post }, 201);
});

app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Partial<NewPost>>();

  if (body.title !== undefined && body.title.length < 3) {
    return c.json({ error: "Title must be at least 3 characters" }, 400);
  }
  if (body.content !== undefined && body.content.length < 10) {
    return c.json({ error: "Content must be at least 10 characters" }, 400);
  }

  const post = await postService.update(id, body);
  return c.json({ data: post });
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await postService.delete(id);
  return c.body(null, 204);
});

export default app;
