import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// Enable CORS for API routes
app.use(cors());

export default app;
