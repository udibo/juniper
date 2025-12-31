import { Hono } from "hono";

import { HttpError } from "@udibo/juniper";
import type { AppEnv } from "@udibo/juniper/server";

import {
  createContact,
  deleteContact,
  getContact,
  getContacts,
  updateContact,
} from "@/services/contact.ts";
import type { ContactUpdate, NewContact } from "@/services/contact.ts";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const contacts = await getContacts();
  return c.json(contacts);
});

app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const contact = await getContact(id);
  if (!contact) {
    throw new HttpError(404, "Contact not found");
  }
  return c.json(contact);
});

app.post("/", async (c) => {
  const data = await c.req.json<NewContact>();
  const contact = await createContact(data);
  return c.json(contact, 201);
});

app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json<Omit<ContactUpdate, "id">>();
  const contact = await updateContact({ ...data, id });
  if (!contact) {
    throw new HttpError(404, "Contact not found");
  }
  return c.json(contact);
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const deleted = await deleteContact(id);
  if (!deleted) {
    throw new HttpError(404, "Contact not found");
  }
  return c.json({ success: true });
});

export default app;
