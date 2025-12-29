import { delay } from "@std/async/delay";

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewContact = Omit<Contact, "id" | "createdAt" | "updatedAt">;
export type ContactUpdate = Partial<NewContact> & { id: string };

const contacts: Map<string, Contact> = new Map();

function generateId(): string {
  return crypto.randomUUID();
}

function seedContactSync(data: NewContact): void {
  const now = new Date();
  const contact: Contact = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  contacts.set(contact.id, contact);
}

seedContactSync({
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  phone: "555-1234",
  notes: "Met at the conference",
});

seedContactSync({
  firstName: "Jane",
  lastName: "Smith",
  email: "jane.smith@example.com",
  phone: "555-5678",
});

seedContactSync({
  firstName: "Bob",
  lastName: "Johnson",
  email: "bob.johnson@example.com",
  notes: "Prefers email communication",
});

export async function getContacts(): Promise<Contact[]> {
  await delay(100);
  return Array.from(contacts.values()).sort((a, b) =>
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName)
  );
}

export async function getContact(id: string): Promise<Contact | null> {
  await delay(50);
  return contacts.get(id) ?? null;
}

export async function createContact(data: NewContact): Promise<Contact> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const now = new Date();
  const contact: Contact = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  contacts.set(contact.id, contact);
  return contact;
}

export async function updateContact(
  data: ContactUpdate,
): Promise<Contact | null> {
  await delay(100);
  const existing = contacts.get(data.id);
  if (!existing) {
    return null;
  }
  const updated: Contact = {
    ...existing,
    ...data,
    updatedAt: new Date(),
  };
  contacts.set(data.id, updated);
  return updated;
}

export async function deleteContact(id: string): Promise<boolean> {
  await delay(100);
  return contacts.delete(id);
}
