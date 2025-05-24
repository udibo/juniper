import { Hono } from "hono";

import type { NewUser, User, UserPatch } from "/services/user.ts";
import { userService } from "/services/user.ts";

const app = new Hono();

app.get("/", async (c) => {
  const queryParams = c.req.query();
  const options = userService.parseListQueryParams(queryParams);

  const { entries: users, cursor } = await userService.list(options);
  return c.json({ users, cursor });
});

app.post("/", async (c) => {
  const newUser = await c.req.json<NewUser>();
  const user = await userService.create(newUser);
  return c.json(user, 201);
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const user = await userService.get(id);
  return c.json(user);
});

app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const userUpdate = await c.req.json<User>();
  const user = await userService.update({ ...userUpdate, id });
  return c.json(user);
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const userPatch = await c.req.json<UserPatch>();
  const user = await userService.patch({ ...userPatch, id });
  return c.json(user);
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await userService.delete(id);
  return c.json({ deleted: true });
});

export default app;
