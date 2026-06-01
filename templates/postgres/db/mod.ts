import { getEnv } from "@udibo/juniper/utils/env";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema.ts";

/**
 * The Drizzle database client, backed by a `node-postgres` connection pool
 * built from the `DATABASE_URL` environment variable. The pool opens no
 * connection until the first query runs, so simply importing this module is
 * cheap.
 */
export const db = drizzle({
  connection: getEnv("DATABASE_URL")!,
  casing: "snake_case",
  schema,
});

let closed = false;

/**
 * Closes the database connection pool. Call this when shutting down the
 * application, or in a test's `afterAll`, to release the pool and avoid leaking
 * resources. Safe to call more than once.
 */
export async function closeDb(): Promise<void> {
  if (closed) return;
  closed = true;
  await db.$client.end();
}
