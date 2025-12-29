import { Form, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { HttpError } from "@udibo/juniper";
import type {
  RouteActionArgs,
  RouteLoaderArgs,
  RouteProps,
} from "@udibo/juniper";

import { queryClientContext } from "@/context/query.ts";
import type { Contact } from "@/services/contact.ts";
import { contactsQuery } from "../index.tsx";

export const contactQuery = (id: string) => ({
  queryKey: ["contact", id],
  queryFn: async () => {
    const response = await fetch(`/api/contacts/${id}`);
    if (!response.ok) {
      throw await HttpError.from(response);
    }
    return response.json() as Promise<Contact>;
  },
});

export async function loader(
  { context, params, serverLoader }: RouteLoaderArgs,
): Promise<Contact> {
  const queryClient = context.get(queryClientContext);
  return await queryClient.ensureQueryData({
    ...contactQuery(params.id!),
    queryFn: () => serverLoader(),
  });
}

export async function action(
  { context, params, serverAction }: RouteActionArgs,
): Promise<Response> {
  const queryClient = context.get(queryClientContext);
  try {
    return await serverAction() as Response;
  } finally {
    queryClient.invalidateQueries(contactsQuery());
    queryClient.removeQueries(contactQuery(params.id!));
  }
}

export default function ContactView({
  loaderData,
  params,
}: RouteProps<{ id: string }, Contact>) {
  const { data: contact } = useQuery({
    ...contactQuery(params.id),
    initialData: loaderData,
    throwOnError: true,
  });

  return (
    <div>
      <title>
        {contact.firstName} {contact.lastName} - Contacts
      </title>
      <h2>
        {contact.firstName} {contact.lastName}
      </h2>

      <p>
        <Link to="/contacts">← Back to Contacts</Link>
      </p>

      <dl>
        <dt>
          <strong>Email:</strong>
        </dt>
        <dd>
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </dd>

        {contact.phone && (
          <>
            <dt>
              <strong>Phone:</strong>
            </dt>
            <dd>
              <a href={`tel:${contact.phone}`}>{contact.phone}</a>
            </dd>
          </>
        )}

        {contact.notes && (
          <>
            <dt>
              <strong>Notes:</strong>
            </dt>
            <dd>{contact.notes}</dd>
          </>
        )}
      </dl>

      <p>
        <small>
          Created: {new Date(contact.createdAt).toLocaleString()}
          <br />
          Updated: {new Date(contact.updatedAt).toLocaleString()}
        </small>
      </p>

      <hr />

      <div>
        <Link to={`/contacts/${contact.id}/edit`}>Edit Contact</Link>
        {" | "}
        <Form method="post" style={{ display: "inline" }}>
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            onClick={(e) => {
              if (!confirm("Are you sure you want to delete this contact?")) {
                e.preventDefault();
              }
            }}
          >
            Delete Contact
          </button>
        </Form>
      </div>
    </div>
  );
}

export function HydrateFallback() {
  return (
    <div>
      <h2>Loading contact...</h2>
    </div>
  );
}
