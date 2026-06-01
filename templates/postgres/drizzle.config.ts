import { defineConfig } from "drizzle-kit";

const url = Deno.env.get("DATABASE_URL");
if (!url) {
  throw new Error("DATABASE_URL is required");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  casing: "snake_case",
});
