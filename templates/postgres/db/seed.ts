import { closeDb, db } from "./mod.ts";
import { messages } from "./schema.ts";

/**
 * Seeds the database with example guestbook messages. Only runs when the table
 * is empty, so it's safe to run more than once.
 */
export async function run(): Promise<void> {
  const [existing] = await db.select({ id: messages.id }).from(messages)
    .limit(1);
  if (existing) {
    console.log("Skipping seed: messages already exist.");
    return;
  }

  await db.insert(messages).values([
    { name: "Ada Lovelace", body: "Hello from the first programmer!" },
    { name: "Grace Hopper", body: "Keep your examples simple." },
  ]);
  console.log("Seeded 2 messages.");
}

if (import.meta.main) {
  await run();
  await closeDb();
}
