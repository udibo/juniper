import { Hono } from "hono";
import { HttpError } from "@udibo/http-error";

import { getInstance } from "@udibo/juniper/utils/otel";

const app = new Hono();

app.onError((cause) => {
  const error = HttpError.from(cause);
  if (!error.instance) {
    const instance = getInstance();
    if (instance) {
      error.instance = instance;
    }
  }
  console.error(error);
  return error.getResponse();
});

export default app;
