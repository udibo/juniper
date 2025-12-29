import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { HttpError } from "@udibo/juniper";
import type { AnyParams, RouteLoaderArgs, RouteProps } from "@udibo/juniper";

import { queryClientContext } from "@/context/query.ts";
import type { Contact } from "@/services/contact.ts";

export const contactsQuery = () => ({
  queryKey: ["contacts"],
  queryFn: async () => {
    const response = await fetch("/api/contacts");
    if (!response.ok) {
      throw await HttpError.from(response);
    }
    return (await response.json()).map((contact: Contact) => ({
      ...contact,
      createdAt: new Date(contact.createdAt),
      updatedAt: new Date(contact.updatedAt),
    })) as Contact[];
  },
});

export type ContactsLoaderData = Contact[];

export async function loader(
  { context, serverLoader }: RouteLoaderArgs,
): Promise<ContactsLoaderData> {
  const queryClient = context.get(queryClientContext);
  return await queryClient.ensureQueryData({
    ...contactsQuery(),
    queryFn: () => serverLoader() as Promise<ContactsLoaderData>,
  });
}

export default function ContactsIndex({
  loaderData,
}: RouteProps<
  AnyParams,
  ContactsLoaderData
>) {
  const { data: contacts } = useQuery({
    ...contactsQuery(),
    initialData: loaderData,
  });
  return (
    <div>
      <title>Contacts - TanStack Query Example</title>
      <h2>Contacts</h2>
      <p>
        This example demonstrates React Query integration with React Router
        loaders. Data is prefetched in the loader using <code>fetchQuery</code>
        {" "}
        and then used with <code>useQuery</code> for caching benefits.
      </p>

      <p>
        <Link to="/contacts/new">+ New Contact</Link>
      </p>

      {contacts.length === 0
        ? (
          <p>
            No contacts yet. <Link to="/contacts/new">Create one!</Link>
          </p>
        )
        : (
          <ul>
            {contacts.map((contact) => (
              <li key={contact.id}>
                <Link to={`/contacts/${contact.id}`}>
                  {contact.firstName} {contact.lastName}
                </Link>
                - {contact.email}
              </li>
            ))}
          </ul>
        )}

      <hr />
      <p>
        <small>
          QueryClient cache entries:{" "}
          {useQueryClient().getQueryCache().getAll().length}
        </small>
      </p>
    </div>
  );
}

export function HydrateFallback() {
  return (
    <div>
      <h2>Loading contacts...</h2>
    </div>
  );
}
