import "global-jsdom/register";

import { assertEquals, assertExists } from "@std/assert";
import { stub } from "@std/testing/mock";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, it } from "@std/testing/bdd";
import type { RouterContextProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  createRoutesStub,
  stubFetch,
  stubFormData,
} from "@udibo/juniper/utils/testing";

import { queryClientContext } from "@/context/query.ts";
import type { Contact } from "@/services/contact.ts";
import * as contactViewRoute from "./index.tsx";

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

describe("Contact view route", () => {
  afterEach(cleanup);

  it("should render contact name as heading", async () => {
    const contact = createTestContact({
      firstName: "Jane",
      lastName: "Smith",
    });

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactViewRoute,
      path: "/contacts/:id",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("heading", { name: "Jane Smith" });
    });
  });

  it("should display contact email", async () => {
    const contact = createTestContact({ email: "jane@example.com" });

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactViewRoute,
      path: "/contacts/:id",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByText("jane@example.com");
    });
    const link = screen.getByRole("link", { name: "jane@example.com" });
    assertEquals(link.getAttribute("href"), "mailto:jane@example.com");
  });

  it("should display contact phone when present", async () => {
    const contact = createTestContact({ phone: "555-1234" });

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactViewRoute,
      path: "/contacts/:id",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByText("555-1234");
    });
    const link = screen.getByRole("link", { name: "555-1234" });
    assertEquals(link.getAttribute("href"), "tel:555-1234");
  });

  it("should display contact notes when present", async () => {
    const contact = createTestContact({ notes: "Important client" });

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactViewRoute,
      path: "/contacts/:id",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByText("Important client");
    });
  });

  it("should have back to contacts link", async () => {
    const contact = createTestContact();

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactViewRoute,
      path: "/contacts/:id",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("link", { name: "← Back to Contacts" });
    });
    const link = screen.getByRole("link", { name: "← Back to Contacts" });
    assertEquals(link.getAttribute("href"), "/contacts");
  });

  it("should have edit contact link", async () => {
    const contact = createTestContact({ id: "contact-123" });

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactViewRoute,
      path: "/contacts/:id",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/contact-123"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("link", { name: "Edit Contact" });
    });
    const link = screen.getByRole("link", { name: "Edit Contact" });
    assertEquals(link.getAttribute("href"), "/contacts/contact-123/edit");
  });

  it("should have delete contact button", async () => {
    const contact = createTestContact();

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactViewRoute,
      path: "/contacts/:id",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("button", { name: "Delete Contact" });
    });
  });

  it("should display contact timestamps", async () => {
    const contact = createTestContact({
      createdAt: new Date("2025-01-15T10:00:00Z"),
      updatedAt: new Date("2025-01-16T15:30:00Z"),
    });

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactViewRoute,
      path: "/contacts/:id",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByText(/Created:/);
    });
    screen.getByText(/Updated:/);
  });

  it("should show HydrateFallback while loading", async () => {
    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactViewRoute,
      path: "/contacts/:id",
      HydrateFallback: contactViewRoute.HydrateFallback,
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("heading", { name: "Loading contact..." });
    });
  });

  describe("delete action", () => {
    it("should call action when delete button is clicked", async () => {
      const contact = createTestContact({ id: "contact-123" });
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["contact", "contact-123"], contact);

      const user = userEvent.setup();
      using _formDataStub = stubFormData();
      using _fetchStub = stubFetch((input) => {
        if (input.toString().includes("/api/contacts")) {
          return Response.json([]);
        }
        return new Response("Not Found", { status: 404 });
      });
      using _confirmStub = stub(globalThis, "confirm", () => true);
      let actionCalled = false;
      let actionFormData: FormData | null = null;

      const Stub = createRoutesStub([
        {
          ...contactViewRoute,
          path: "/contacts/:id",
          loader() {
            return contact;
          },
          action: async ({ request }) => {
            actionCalled = true;
            actionFormData = await request.formData();
            return new Response(null, {
              status: 302,
              headers: { Location: "/contacts" },
            });
          },
        },
        {
          path: "/contacts",
          default: () => <div>Contacts List</div>,
        },
      ], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub initialEntries={["/contacts/contact-123"]} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("button", { name: "Delete Contact" });
      });

      await user.click(screen.getByRole("button", { name: "Delete Contact" }));

      await waitFor(() => {
        assertEquals(actionCalled, true);
      });

      await waitFor(() => {
        assertExists(actionFormData);
        assertEquals(actionFormData.get("intent"), "delete");
      });
    });

    it("should not call action when delete is cancelled", async () => {
      const contact = createTestContact({ id: "contact-123" });
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["contact", "contact-123"], contact);

      const user = userEvent.setup();
      using _fetchStub = stubFetch((input) => {
        if (input.toString().includes("/api/contacts")) {
          return Response.json(contact);
        }
        return new Response("Not Found", { status: 404 });
      });
      using _confirmStub = stub(globalThis, "confirm", () => false);
      let actionCalled = false;

      const Stub = createRoutesStub([
        {
          ...contactViewRoute,
          path: "/contacts/:id",
          loader() {
            return contact;
          },
          action: () => {
            actionCalled = true;
            return contact;
          },
        },
      ], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub initialEntries={["/contacts/contact-123"]} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("button", { name: "Delete Contact" });
      });

      await user.click(screen.getByRole("button", { name: "Delete Contact" }));

      await new Promise((resolve) => setTimeout(resolve, 100));

      assertEquals(actionCalled, false);
    });

    it("should navigate to contacts list after successful delete", async () => {
      const contact = createTestContact({ id: "contact-123" });
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["contact", "contact-123"], contact);

      const user = userEvent.setup();
      using _formDataStub = stubFormData();
      using _fetchStub = stubFetch((input) => {
        if (input.toString().includes("/api/contacts")) {
          return Response.json([]);
        }
        return new Response("Not Found", { status: 404 });
      });
      using _confirmStub = stub(globalThis, "confirm", () => true);

      const Stub = createRoutesStub([
        {
          ...contactViewRoute,
          path: "/contacts/:id",
          loader() {
            return contact;
          },
          action: () => {
            return new Response(null, {
              status: 302,
              headers: { Location: "/contacts" },
            });
          },
        },
        {
          path: "/contacts",
          default: () => <div>Contacts List Page</div>,
        },
      ], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub initialEntries={["/contacts/contact-123"]} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("button", { name: "Delete Contact" });
      });

      await user.click(screen.getByRole("button", { name: "Delete Contact" }));

      await waitFor(() => {
        screen.getByText("Contacts List Page");
      });
    });
  });
});
