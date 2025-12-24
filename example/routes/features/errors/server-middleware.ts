import { Hono } from "hono";
import { HttpError } from "@udibo/juniper";

import type { AppEnv } from "@udibo/juniper/server";

const app = new Hono<AppEnv>();

app.use(async (_c, _next) => {
  throw new HttpError(403, "Access denied - this error was thrown by server middleware");
});

export default app;


