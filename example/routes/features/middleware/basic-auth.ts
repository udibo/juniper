import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

import type { AppEnv } from "@udibo/juniper/server";

import type { LoaderData } from "./basic-auth.tsx";

const app = new Hono<AppEnv>();

app.use(basicAuth({
  username: "admin",
  password: "password",
}));

export default app;

export function loader(): LoaderData {
  return {
    authenticatedAt: new Date().toISOString(),
  };
}
