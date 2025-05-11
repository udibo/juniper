import { Hono } from "hono";
import { HttpError } from "@udibo/http-error";

const app = new Hono();

app.onError((cause) => {
  const error = HttpError.from(cause);
  console.error(error);
  return error.getResponse();
});

export default app;
