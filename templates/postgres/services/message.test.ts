import { assertEquals, assertExists } from "@std/assert";
import { afterAll, describe, it } from "@std/testing/bdd";

import { closeDb } from "@/db/mod.ts";
import {
  createMessage,
  deleteMessage,
  listMessages,
  newMessageSchema,
} from "@/services/message.ts";

describe("message service", () => {
  afterAll(async () => {
    await closeDb();
  });

  describe("newMessageSchema", () => {
    it("should accept and trim valid input", () => {
      const result = newMessageSchema.safeParse({
        name: "  Ada  ",
        body: "  Hello  ",
      });
      assertEquals(result.success, true);
      assertEquals(result.data?.name, "Ada");
      assertEquals(result.data?.body, "Hello");
    });

    it("should reject empty fields", () => {
      assertEquals(
        newMessageSchema.safeParse({ name: "", body: "" }).success,
        false,
      );
    });
  });

  describe("create, list, and delete", () => {
    it("should create a message and list it back", async () => {
      const created = await createMessage({
        name: "Test User",
        body: "Test message",
      });
      assertExists(created.id);
      assertEquals(created.name, "Test User");
      assertEquals(created.body, "Test message");
      assertExists(created.createdAt);

      const messages = await listMessages();
      assertEquals(messages.some((message) => message.id === created.id), true);

      const deleted = await deleteMessage(created.id);
      assertEquals(deleted, true);

      const remaining = await listMessages();
      assertEquals(
        remaining.some((message) => message.id === created.id),
        false,
      );
    });

    it("should return false when deleting a non-existent message", async () => {
      assertEquals(await deleteMessage(-1), false);
    });
  });
});
