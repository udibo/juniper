import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use(cors());

export default app;
