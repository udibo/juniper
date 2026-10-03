import { Hono } from "hono";

import { postService } from "@/services/post.ts";
import type { NewPost } from "@/services/post.ts";

const app = new Hono();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  const body = await c.req.json<unknown>();
  if (!isObject(body)) {
    return c.json({ error: "Body must be a JSON object" }, 400);
  }

  if (typeof body.title !== "string" || body.title.length < 3) {
    return c.json({ error: "Title must be at least 3 characters" }, 400);
  }
  if (typeof body.content !== "string" || body.content.length < 10) {
    return c.json({ error: "Content must be at least 10 characters" }, 400);
  }

  const post = await postService.create({
    title: body.title,
    content: body.content,
  });
  return c.json({ data: post }, 201);
});

app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<unknown>();
  if (!isObject(body)) {
    return c.json({ error: "Body must be a JSON object" }, 400);
  }

  const data: Partial<NewPost> = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.length < 3) {
      return c.json({ error: "Title must be at least 3 characters" }, 400);
    }
    data.title = body.title;
  }
  if (body.content !== undefined) {
    if (typeof body.content !== "string" || body.content.length < 10) {
      return c.json({ error: "Content must be at least 10 characters" }, 400);
    }
    data.content = body.content;
  }

  const post = await postService.update(id, data);
  return c.json({ data: post });
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await postService.delete(id);
  return c.body(null, 204);
});

export default app;
