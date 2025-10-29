import { HttpError } from "@udibo/http-error";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  const api = c.req.param("api");
  throw new HttpError(404, `${api} does not exist`);
});

export default app;
