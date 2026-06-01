import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());

export default app;
