import "@udibo/juniper/utils/global-jsdom";

import { assertEquals } from "@std/assert";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import type { Message } from "@/services/message.ts";
import * as indexRoute from "./index.tsx";
import type { GuestbookActionData, GuestbookLoaderData } from "./index.tsx";

function createTestMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    name: "Ada Lovelace",
    body: "Hello from the first programmer!",
    createdAt: new Date("2025-01-15T12:00:00.000Z"),
    ...overrides,
  };
}

describe("Guestbook route", () => {
  afterEach(cleanup);

  it("should render the form and messages from the loader", async () => {
    const loaderData: GuestbookLoaderData = {
      messages: [
        createTestMessage({ id: 1, name: "Ada Lovelace", body: "First!" }),
        createTestMessage({
          id: 2,
          name: "Grace Hopper",
          body: "Keep it simple.",
        }),
      ],
    };
    const Stub = createRoutesStub([{
      ...indexRoute,
      loader: () => loaderData,
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByRole("heading", { name: "Guestbook" });
    });
    screen.getByRole("button", { name: "Sign guestbook" });
    screen.getByText("Ada Lovelace");
    screen.getByText("First!");
    screen.getByText("Grace Hopper");
    assertEquals(screen.getAllByRole("button", { name: "Delete" }).length, 2);
  });

  it("should render an empty state when there are no messages", async () => {
    const loaderData: GuestbookLoaderData = { messages: [] };
    const Stub = createRoutesStub([{
      ...indexRoute,
      loader: () => loaderData,
    }]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("No messages yet. Be the first to sign!");
    });
    assertEquals(screen.queryAllByRole("button", { name: "Delete" }).length, 0);
  });

  it("should render validation errors returned by the action", async () => {
    const loaderData: GuestbookLoaderData = { messages: [] };
    const actionData: GuestbookActionData = {
      errors: { name: "Name is required", body: "Message is required" },
    };
    const Stub = createRoutesStub([{
      ...indexRoute,
      loader: () => loaderData,
      action: () => actionData,
    }]);
    render(
      <Stub
        hydrationData={{
          actionData: { "0": actionData },
          loaderData: { "0": loaderData },
        }}
      />,
    );

    await waitFor(() => {
      screen.getByText("Name is required");
    });
    screen.getByText("Message is required");
  });
});
