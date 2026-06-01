import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Guestbook messages.
 *
 * Columns are declared in camelCase and mapped to snake_case in PostgreSQL by
 * the `casing: "snake_case"` option configured on the Drizzle client and in
 * `drizzle.config.ts` (so `createdAt` becomes the `created_at` column).
 */
export const messages = pgTable("messages", {
  id: serial().primaryKey(),
  name: text().notNull(),
  body: text().notNull(),
  createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
});
