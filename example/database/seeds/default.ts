import { getDb } from "../mod.ts";
import { usersTable } from "../schema/users.ts";
import { generateSalt, hashPassword } from "/utils/auth.ts";

const db = getDb();

async function main() {
  const passwordSalt = generateSalt();
  await db.insert(usersTable).values({
    username: "admin",
    displayName: "Admin",
    email: "admin@udibo.com",
    passwordHash: await hashPassword("password", passwordSalt),
    passwordSalt,
  });
}

main();
