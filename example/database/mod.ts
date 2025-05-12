import {
  drizzle,
  type NodePgClient,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export type Database = NodePgDatabase<Record<string, unknown>> & {
  $client: NodePgClient;
};

let pool: Pool | null = null;
let db: Database | null = null;

/**
 * Returns a drizzle client.
 *
 * This function will create a new drizzle client if one does not already exist.
 * It will also create a new database pool if one does not already exist.
 *
 * @returns a drizzle client
 */
export function getDb(): Database {
  if (!db) {
    const dbUrl = Deno.env.get("DATABASE_URL");
    if (!dbUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool({ connectionString: dbUrl });
    db = drizzle(pool, { casing: "snake_case" });
  }
  return db;
}

/**
 * Closes the database pool. This only needs to be called in tests to avoid
 * leaving open connections.
 */
export async function closeDb() {
  if (pool) {
    if (!pool.ended) await pool!.end();
    pool = null;
    db = null;
  } else {
    throw new Error("Database not initialized");
  }
}

/**
 * Simulates a database failure for testing purposes.
 *
 * This function will end the database pool.
 */
export async function simulateDbFailure() {
  if (!pool) {
    throw new Error("Database not initialized");
  }
  if (!pool.ended) await pool.end();
}
