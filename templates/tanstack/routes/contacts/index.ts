import type { RouteLoaderArgs } from "@udibo/juniper";

import { queryClientContext } from "@/context/query.ts";
import { getContacts } from "@/services/contact.ts";

import { ContactsLoaderData, contactsQuery } from "./index.tsx";

export async function loader(
  { context }: RouteLoaderArgs,
): Promise<ContactsLoaderData> {
  const queryClient = context.get(queryClientContext);
  return await queryClient.ensureQueryData({
    ...contactsQuery(),
    queryFn: () => getContacts(),
  });
}
