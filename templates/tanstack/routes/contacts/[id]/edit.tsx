import { Form, Link, useNavigation } from "react-router";
import { useQuery } from "@tanstack/react-query";

import type {
  RouteActionArgs,
  RouteLoaderArgs,
  RouteProps,
} from "@udibo/juniper";

import { queryClientContext } from "@/context/query.ts";
import type { Contact } from "@/services/contact.ts";
import { contactsQuery } from "../index.tsx";

import { contactQuery } from "./index.tsx";

export async function loader(
  { context, params, serverLoader }: RouteLoaderArgs<{ id: string }, Contact>,
): Promise<Contact> {
  const queryClient = context.get(queryClientContext);
  return await queryClient.ensureQueryData({
    ...contactQuery(params.id),
    queryFn: () => serverLoader(),
  });
}

export async function action(
  { context, params, serverAction }: RouteActionArgs<{ id: string }>,
): Promise<void> {
  const queryClient = context.get(queryClientContext);
  try {
    await serverAction();
  } finally {
    queryClient.invalidateQueries(contactsQuery());
    queryClient.invalidateQueries(contactQuery(params.id));
  }
}

export default function ContactEdit({
  loaderData,
  params,
}: RouteProps<{ id: string }, Contact>) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const { data: contact } = useQuery({
    ...contactQuery(params.id),
    initialData: loaderData,
    throwOnError: true,
  });

  return (
    <div>
      <title>
        Edit {contact.firstName} {contact.lastName} - Contacts
      </title>
      <h2>
        Edit {contact.firstName} {contact.lastName}
      </h2>

      <p>
        <Link to={`/contacts/${contact.id}`}>← Back to Contact</Link>
      </p>

      <Form method="post">
        <div>
          <label htmlFor="firstName">First Name:</label>
          <br />
          <input
            type="text"
            id="firstName"
            name="firstName"
            defaultValue={contact.firstName}
            required
          />
        </div>

        <div>
          <label htmlFor="lastName">Last Name:</label>
          <br />
          <input
            type="text"
            id="lastName"
            name="lastName"
            defaultValue={contact.lastName}
            required
          />
        </div>

        <div>
          <label htmlFor="email">Email:</label>
          <br />
          <input
            type="email"
            id="email"
            name="email"
            defaultValue={contact.email}
            required
          />
        </div>

        <div>
          <label htmlFor="phone">Phone:</label>
          <br />
          <input
            type="tel"
            id="phone"
            name="phone"
            defaultValue={contact.phone ?? ""}
          />
        </div>

        <div>
          <label htmlFor="notes">Notes:</label>
          <br />
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={contact.notes ?? ""}
          />
        </div>

        <p>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>{" "}
          <Link to={`/contacts/${contact.id}`}>Cancel</Link>
        </p>
      </Form>
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
