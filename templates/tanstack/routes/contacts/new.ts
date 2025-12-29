import { redirect } from "react-router";

import type { RouteActionArgs } from "@udibo/juniper";

import { createContact } from "@/services/contact.ts";

export async function action(
  { request }: RouteActionArgs,
): Promise<Response> {
  const formData = await request.formData();

  const contact = await createContact({
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  });

  throw redirect(`/contacts/${contact.id}`);
}
