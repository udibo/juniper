import "@udibo/juniper/utils/global-jsdom";

import { assertEquals } from "@std/assert";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";
import type { RouterContextProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import { queryClientContext } from "@/context/query.ts";
import type { Contact } from "@/services/contact.ts";
import * as contactsRoute from "./index.tsx";

function createTestContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "test-id",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    createdAt: new Date("2025-01-15"),
    updatedAt: new Date("2025-01-15"),
    ...overrides,
  };
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function getContext(queryClient: QueryClient) {
  return (context: RouterContextProvider) => {
    context.set(queryClientContext, queryClient);
  };
}

describe("Contacts index route", () => {
  afterEach(cleanup);

  it("should render the contacts heading", async () => {
    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactsRoute,
      path: "/contacts",
      loader() {
        return [];
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("heading", { name: "Contacts" });
    });
  });

  it("should show empty state when no contacts", async () => {
    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactsRoute,
      path: "/contacts",
      loader() {
        return [];
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByText(/No contacts yet/);
    });
  });

  it("should render contacts list", async () => {
    const contacts: Contact[] = [
      createTestContact({
        id: "1",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      }),
      createTestContact({
        id: "2",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
      }),
    ];

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactsRoute,
      path: "/contacts",
      loader() {
        return contacts;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("link", { name: "John Doe" });
    });
    screen.getByRole("link", { name: "Jane Smith" });
    screen.getByText(/john@example.com/);
    screen.getByText(/jane@example.com/);
  });

  it("should have a link to create new contact", async () => {
    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactsRoute,
      path: "/contacts",
      loader() {
        return [];
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("link", { name: "+ New Contact" });
    });
    const link = screen.getByRole("link", { name: "+ New Contact" });
    assertEquals(link.getAttribute("href"), "/contacts/new");
  });

  it("should link to contact detail page", async () => {
    const contacts: Contact[] = [
      createTestContact({
        id: "contact-123",
        firstName: "Test",
        lastName: "User",
      }),
    ];

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactsRoute,
      path: "/contacts",
      loader() {
        return contacts;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("link", { name: "Test User" });
    });
    const link = screen.getByRole("link", { name: "Test User" });
    assertEquals(link.getAttribute("href"), "/contacts/contact-123");
  });

  it("should show HydrateFallback while loading", async () => {
    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactsRoute,
      path: "/contacts",
      HydrateFallback: contactsRoute.HydrateFallback,
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("heading", { name: "Loading contacts..." });
    });
  });
});
