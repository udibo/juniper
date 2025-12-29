import { redirect } from "react-router";

import { HttpError } from "@udibo/juniper";
import type { RouteActionArgs, RouteLoaderArgs } from "@udibo/juniper";

import { queryClientContext } from "@/context/query.ts";
import { getContact, updateContact } from "@/services/contact.ts";
import type { Contact } from "@/services/contact.ts";

import { contactQuery } from "./index.tsx";

export async function loader(
  { context, params }: RouteLoaderArgs,
): Promise<Contact> {
  const queryClient = context.get(queryClientContext);
  return await queryClient.ensureQueryData({
    ...contactQuery(params.id!),
    queryFn: async () => {
      const contact = await getContact(params.id!);
      if (!contact) {
        throw new HttpError(404, "Contact not found");
      }
      return contact;
    },
  });
}

export async function action(
  { request, params }: RouteActionArgs,
): Promise<Response> {
  const formData = await request.formData();

  await updateContact({
    id: params.id!,
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  });

  throw redirect(`/contacts/${params.id}`);
}
