import { Hono } from "hono";
import { HttpError } from "@udibo/http-error";

const app = new Hono();

app.get("/", (c) => {
  const api = c.req.param("api");
  throw new HttpError(404, `${api} does not exist`);
});

export default app;
