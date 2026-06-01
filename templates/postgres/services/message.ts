import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/mod.ts";
import { messages } from "@/db/schema.ts";

/** A guestbook message row, inferred from the Drizzle schema. */
export type Message = typeof messages.$inferSelect;

/** Validates the fields needed to sign the guestbook. */
export const newMessageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  body: z.string().trim().min(1, "Message is required").max(1000),
});

/** Validated input for creating a message. */
export type NewMessage = z.infer<typeof newMessageSchema>;

/** Returns all messages, newest first. */
export async function listMessages(): Promise<Message[]> {
  return await db.select().from(messages).orderBy(desc(messages.createdAt));
}

/** Inserts a new message and returns the created row. */
export async function createMessage(data: NewMessage): Promise<Message> {
  const [message] = await db.insert(messages).values(data).returning();
  return message;
}

/** Deletes a message by id. Returns true when a row was removed. */
export async function deleteMessage(id: number): Promise<boolean> {
  const deleted = await db.delete(messages).where(eq(messages.id, id))
    .returning({ id: messages.id });
  return deleted.length > 0;
}
