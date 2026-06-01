import { Form, useNavigation } from "react-router";

import type { AnyParams, RouteProps } from "@udibo/juniper";

import type { Message } from "@/services/message.ts";

export interface GuestbookLoaderData {
  messages: Message[];
}

export interface GuestbookActionData {
  errors?: {
    name?: string;
    body?: string;
  };
}

export default function Guestbook({
  loaderData,
  actionData,
}: RouteProps<AnyParams, GuestbookLoaderData, GuestbookActionData>) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const { messages } = loaderData;

  return (
    <>
      <title>Guestbook</title>
      <meta name="description" content="A PostgreSQL-backed guestbook" />
      <h2>Guestbook</h2>
      <p>
        Sign the guestbook below. Messages are stored in PostgreSQL with Drizzle
        ORM and validated with Zod.
      </p>

      <Form method="post">
        <p>
          <label>
            Name<br />
            <input type="text" name="name" maxLength={100} required />
          </label>
          {actionData?.errors?.name && (
            <span role="alert">{actionData.errors.name}</span>
          )}
        </p>
        <p>
          <label>
            Message<br />
            <textarea name="body" rows={3} maxLength={1000} required />
          </label>
          {actionData?.errors?.body && (
            <span role="alert">{actionData.errors.body}</span>
          )}
        </p>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing..." : "Sign guestbook"}
        </button>
      </Form>

      <hr />

      {messages.length === 0
        ? <p>No messages yet. Be the first to sign!</p>
        : (
          <ul>
            {messages.map((message) => (
              <li key={message.id}>
                <strong>{message.name}</strong>{" "}
                <small>{message.createdAt.toLocaleString()}</small>
                <p>{message.body}</p>
                <Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <input type="hidden" name="id" value={message.id} />
                  <button type="submit">Delete</button>
                </Form>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}
