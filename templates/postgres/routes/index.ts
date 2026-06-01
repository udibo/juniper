import { redirect } from "react-router";

import type {
  AnyParams,
  RouteActionArgs,
  RouteLoaderArgs,
} from "@udibo/juniper";

import {
  createMessage,
  deleteMessage,
  listMessages,
  newMessageSchema,
} from "@/services/message.ts";

import type { GuestbookActionData, GuestbookLoaderData } from "./index.tsx";

export async function loader(
  _args: RouteLoaderArgs<AnyParams, GuestbookLoaderData>,
): Promise<GuestbookLoaderData> {
  const messages = await listMessages();
  return { messages };
}

export async function action(
  { request }: RouteActionArgs<AnyParams, GuestbookActionData>,
): Promise<GuestbookActionData> {
  const formData = await request.formData();

  if (formData.get("intent") === "delete") {
    const id = Number(formData.get("id"));
    if (Number.isInteger(id)) {
      await deleteMessage(id);
    }
    throw redirect("/");
  }

  const result = newMessageSchema.safeParse({
    name: formData.get("name") ?? "",
    body: formData.get("body") ?? "",
  });

  if (!result.success) {
    const errors: NonNullable<GuestbookActionData["errors"]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if ((field === "name" || field === "body") && !errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { errors };
  }

  await createMessage(result.data);
  throw redirect("/");
}
