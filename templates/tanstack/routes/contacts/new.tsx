import { Form, Link, useNavigation } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { HttpError } from "@udibo/juniper";
import type { RouteActionArgs, RouteProps } from "@udibo/juniper";

import { queryClientContext } from "@/context/query.ts";
import type { Contact, NewContact } from "@/services/contact.ts";
import { contactsQuery } from "./index.tsx";

export async function action(
  { context, serverAction }: RouteActionArgs,
): Promise<Response> {
  const queryClient = context.get(queryClientContext);
  try {
    return await serverAction() as Response;
  } finally {
    queryClient.invalidateQueries(contactsQuery());
  }
}

export default function NewContact({}: RouteProps) {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isSubmitting = navigation.state === "submitting";

  const createMutation = useMutation({
    mutationFn: async (data: NewContact) => {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw await HttpError.from(response);
      }
      return response.json() as Promise<Contact>;
    },
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      navigate(`/contacts/${contact.id}`);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    createMutation.mutate({
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    });
  };

  return (
    <div>
      <title>New Contact - TanStack Query Example</title>
      <h2>New Contact</h2>

      <p>
        <Link to="/contacts">← Back to Contacts</Link>
      </p>

      <h3>Using useMutation</h3>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="firstName">First Name:</label>
          <br />
          <input type="text" id="firstName" name="firstName" required />
        </div>

        <div>
          <label htmlFor="lastName">Last Name:</label>
          <br />
          <input type="text" id="lastName" name="lastName" required />
        </div>

        <div>
          <label htmlFor="email">Email:</label>
          <br />
          <input type="email" id="email" name="email" required />
        </div>

        <div>
          <label htmlFor="phone">Phone:</label>
          <br />
          <input type="tel" id="phone" name="phone" />
        </div>

        <div>
          <label htmlFor="notes">Notes:</label>
          <br />
          <textarea id="notes" name="notes" rows={3} />
        </div>

        <p>
          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Contact"}
          </button>
        </p>

        {createMutation.isError && (
          <p style={{ color: "red" }}>
            Error creating contact: {createMutation.error.message}
          </p>
        )}
      </form>

      <hr />

      <h3>Using Server Action Form</h3>
      <p>
        Alternatively, you can use React Router's Form component with server
        actions. The server action creates the contact, invalidates queries, and
        redirects to the new contact's page.
      </p>
      <Form method="post">
        <input type="text" name="firstName" placeholder="First Name" required />
        <input type="text" name="lastName" placeholder="Last Name" required />
        <input type="email" name="email" placeholder="Email" required />
        <input type="tel" name="phone" placeholder="Phone" />
        <textarea name="notes" placeholder="Notes" rows={2} />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create via Server Action"}
        </button>
      </Form>
    </div>
  );
}
