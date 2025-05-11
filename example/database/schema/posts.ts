import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { usersTable } from "./users.ts";

export const postsTable = pgTable("posts", {
  id: uuid().primaryKey().default(sql`uuid_generate_v7()`),
  title: text().notNull(),
  content: text().notNull(),
  authorId: uuid().notNull().references(() => usersTable.id),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
  deletedAt: timestamp(),
});

export const postSelectSchema = createSelectSchema(postsTable);
export const postInsertSchema = createInsertSchema(postsTable, {
  title: (schema) => schema.min(1).max(255),
  content: (schema) => schema.min(1),
}).omit({ id: true });

export type Post = typeof postSelectSchema._type;
export type NewPost = typeof postInsertSchema._type;
