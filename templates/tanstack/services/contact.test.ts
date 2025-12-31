import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { delay } from "@std/async/delay";
import { describe, it } from "@std/testing/bdd";

import {
  createContact,
  deleteContact,
  getContact,
  getContacts,
  updateContact,
} from "./contact.ts";
import type { NewContact } from "./contact.ts";

describe("Contact service", () => {
  let createdContactId: string;

  describe("getContacts", () => {
    it("should return an array of contacts", async () => {
      const contacts = await getContacts();
      assertEquals(Array.isArray(contacts), true);
    });

    it("should return seeded contacts", async () => {
      const contacts = await getContacts();
      assertEquals(contacts.length >= 3, true);
    });

    it("should return contacts sorted by last name", async () => {
      const contacts = await getContacts();
      for (let i = 1; i < contacts.length; i++) {
        const current = contacts[i];
        const previous = contacts[i - 1];
        const comparison = previous.lastName.localeCompare(current.lastName) ||
          previous.firstName.localeCompare(current.firstName);
        assertEquals(comparison <= 0, true);
      }
    });
  });

  describe("createContact", () => {
    it("should create a new contact", async () => {
      const newContact: NewContact = {
        firstName: "Test",
        lastName: "Contact",
        email: "test@example.com",
        phone: "555-0000",
        notes: "Test notes",
      };

      const contact = await createContact(newContact);
      createdContactId = contact.id;

      assertExists(contact.id);
      assertEquals(contact.firstName, "Test");
      assertEquals(contact.lastName, "Contact");
      assertEquals(contact.email, "test@example.com");
      assertEquals(contact.phone, "555-0000");
      assertEquals(contact.notes, "Test notes");
      assertExists(contact.createdAt);
      assertExists(contact.updatedAt);
    });

    it("should generate unique IDs", async () => {
      const contact1 = await createContact({
        firstName: "First",
        lastName: "User",
        email: "first@example.com",
      });
      const contact2 = await createContact({
        firstName: "Second",
        lastName: "User",
        email: "second@example.com",
      });

      assertNotEquals(contact1.id, contact2.id);

      await deleteContact(contact1.id);
      await deleteContact(contact2.id);
    });

    it("should allow optional phone and notes", async () => {
      const contact = await createContact({
        firstName: "Minimal",
        lastName: "User",
        email: "minimal@example.com",
      });

      assertEquals(contact.phone, undefined);
      assertEquals(contact.notes, undefined);

      await deleteContact(contact.id);
    });
  });

  describe("getContact", () => {
    it("should return a contact by id", async () => {
      const contact = await getContact(createdContactId);

      assertExists(contact);
      assertEquals(contact!.id, createdContactId);
      assertEquals(contact!.firstName, "Test");
    });

    it("should return null for non-existent id", async () => {
      const contact = await getContact("non-existent-id");
      assertEquals(contact, null);
    });
  });

  describe("updateContact", () => {
    it("should update an existing contact", async () => {
      const updated = await updateContact({
        id: createdContactId,
        firstName: "Updated",
        lastName: "Name",
      });

      assertExists(updated);
      assertEquals(updated!.firstName, "Updated");
      assertEquals(updated!.lastName, "Name");
      assertEquals(updated!.email, "test@example.com");
    });

    it("should update the updatedAt timestamp", async () => {
      const before = await getContact(createdContactId);
      assertExists(before);

      await delay(10);

      const after = await updateContact({
        id: createdContactId,
        notes: "New notes",
      });

      assertExists(after);
      assertEquals(
        after!.updatedAt.getTime() >= before!.updatedAt.getTime(),
        true,
      );
    });

    it("should return null for non-existent id", async () => {
      const result = await updateContact({
        id: "non-existent-id",
        firstName: "Test",
      });
      assertEquals(result, null);
    });

    it("should preserve unmodified fields", async () => {
      const contact = await createContact({
        firstName: "Preserve",
        lastName: "Test",
        email: "preserve@example.com",
        phone: "555-1111",
        notes: "Original notes",
      });

      const updated = await updateContact({
        id: contact.id,
        firstName: "Changed",
      });

      assertExists(updated);
      assertEquals(updated!.firstName, "Changed");
      assertEquals(updated!.lastName, "Test");
      assertEquals(updated!.email, "preserve@example.com");
      assertEquals(updated!.phone, "555-1111");
      assertEquals(updated!.notes, "Original notes");

      await deleteContact(contact.id);
    });
  });

  describe("deleteContact", () => {
    it("should delete an existing contact", async () => {
      const result = await deleteContact(createdContactId);
      assertEquals(result, true);

      const contact = await getContact(createdContactId);
      assertEquals(contact, null);
    });

    it("should return false for non-existent id", async () => {
      const result = await deleteContact("non-existent-id");
      assertEquals(result, false);
    });
  });
});
