import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { eq, sql } from "drizzle-orm";
import { simulateEnvironment } from "@udibo/juniper/utils/testing";

import { closeDb, Database, getDb, simulateDbFailure } from "./mod.ts";
import { usersTable } from "./schema/users.ts";

describe("getDb", () => {
  it("should return the same database", async () => {
    const db = getDb();
    try {
      assertStrictEquals(db, getDb());
    } finally {
      await closeDb();
    }
  });

  it("should throw an error if the DATABASE_URL environment variable is not set", () => {
    using _env = simulateEnvironment({
      DATABASE_URL: null,
    });
    assertThrows(
      () => {
        getDb();
      },
      Error,
      "DATABASE_URL environment variable is not set",
    );
  });
});

describe("closeDb", () => {
  it("should close the database", async () => {
    const db = getDb();
    assertEquals((await db.execute(sql`SELECT 1`)).rowCount, 1);
    await closeDb();
    await assertRejects(
      async () => {
        await db.execute(sql`SELECT 1`);
      },
      Error,
    );
  });

  it("should throw an error if the database is not initialized", async () => {
    await assertRejects(
      async () => {
        await closeDb();
      },
      Error,
      "Database not initialized",
    );
  });
});

describe("simulateDbFailure", () => {
  it("should close the database", async () => {
    const db = getDb();
    assertEquals((await db.execute(sql`SELECT 1`)).rowCount, 1);
    try {
      await simulateDbFailure();
      await assertRejects(
        async () => {
          await db.execute(sql`SELECT 1`);
        },
        Error,
      );
    } finally {
      await closeDb();
    }
  });

  it("should throw an error if the database is not initialized", async () => {
    await assertRejects(
      async () => await simulateDbFailure(),
      Error,
      "Database not initialized",
    );
  });
});

describe("database", () => {
  let db: Database;

  beforeAll(() => {
    db = getDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("seeded with admin user", async () => {
    const result = await db.select().from(usersTable).where(
      eq(usersTable.username, "admin"),
    ).limit(1);
    assertEquals(result.length, 1);
    assertEquals(result[0].username, "admin");
  });
});
