import "@udibo/juniper/utils/global-jsdom";

import { assertEquals, assertExists } from "@std/assert";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, it } from "@std/testing/bdd";
import type { RouterContextProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { createRoutesStub, stubFetch } from "@udibo/juniper/utils/testing";

import { queryClientContext } from "@/context/query.ts";
import type { Contact } from "@/services/contact.ts";
import * as contactEditRoute from "./edit.tsx";

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

describe("Contact edit route", () => {
  afterEach(cleanup);

  it("should render edit heading with contact name", async () => {
    const contact = createTestContact({
      firstName: "Jane",
      lastName: "Smith",
    });

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactEditRoute,
      path: "/contacts/:id/edit",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id/edit"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("heading", { name: "Edit Jane Smith" });
    });
  });

  it("should have back to contact link", async () => {
    const contact = createTestContact({ id: "contact-123" });

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactEditRoute,
      path: "/contacts/:id/edit",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/contact-123/edit"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("link", { name: "← Back to Contact" });
    });
    const link = screen.getByRole("link", { name: "← Back to Contact" });
    assertEquals(link.getAttribute("href"), "/contacts/contact-123");
  });

  it("should display form with all fields", async () => {
    const contact = createTestContact();

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactEditRoute,
      path: "/contacts/:id/edit",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id/edit"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByLabelText("First Name:");
    });
    screen.getByLabelText("Last Name:");
    screen.getByLabelText("Email:");
    screen.getByLabelText("Phone:");
    screen.getByLabelText("Notes:");
  });

  it("should pre-fill form with contact data", async () => {
    const contact = createTestContact({
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "555-1234",
      notes: "Important client",
    });

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactEditRoute,
      path: "/contacts/:id/edit",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id/edit"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByDisplayValue("Jane");
    });
    screen.getByDisplayValue("Smith");
    screen.getByDisplayValue("jane@example.com");
    screen.getByDisplayValue("555-1234");
    screen.getByDisplayValue("Important client");
  });

  it("should have save and cancel buttons", async () => {
    const contact = createTestContact({ id: "contact-123" });

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactEditRoute,
      path: "/contacts/:id/edit",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/contact-123/edit"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("button", { name: "Save Changes" });
    });
    const cancelLink = screen.getByRole("link", { name: "Cancel" });
    assertEquals(cancelLink.getAttribute("href"), "/contacts/contact-123");
  });

  it("should have required attribute on name and email fields", async () => {
    const contact = createTestContact();

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactEditRoute,
      path: "/contacts/:id/edit",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id/edit"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByLabelText("First Name:");
    });
    const firstName = screen.getByLabelText("First Name:") as HTMLInputElement;
    const lastName = screen.getByLabelText("Last Name:") as HTMLInputElement;
    const email = screen.getByLabelText("Email:") as HTMLInputElement;

    assertEquals(firstName.required, true);
    assertEquals(lastName.required, true);
    assertEquals(email.required, true);
  });

  it("should not require phone and notes fields", async () => {
    const contact = createTestContact();

    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      ...contactEditRoute,
      path: "/contacts/:id/edit",
      loader() {
        return contact;
      },
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id/edit"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByLabelText("Phone:");
    });
    const phone = screen.getByLabelText("Phone:") as HTMLInputElement;
    const notes = screen.getByLabelText("Notes:") as HTMLTextAreaElement;

    assertEquals(phone.required, false);
    assertEquals(notes.required, false);
  });

  it("should show HydrateFallback while loading", async () => {
    const queryClient = createTestQueryClient();
    const Stub = createRoutesStub([{
      path: "/contacts/:id/edit",
      default: contactEditRoute.default,
      HydrateFallback: contactEditRoute.HydrateFallback,
      // Loader that never resolves to keep HydrateFallback visible
      loader: () => new Promise(() => {}),
    }], { getContext: getContext(queryClient) });
    render(
      <QueryClientProvider client={queryClient}>
        <Stub initialEntries={["/contacts/test-id/edit"]} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      screen.getByRole("heading", { name: "Loading contact..." });
    });
  });

  describe("form submission", () => {
    it("should call action when form is submitted", async () => {
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
      let actionCalled = false;
      let actionFormData: FormData | null = null;

      const Stub = createRoutesStub([
        {
          path: "/contacts/:id/edit",
          default: contactEditRoute.default,
          HydrateFallback: contactEditRoute.HydrateFallback,
          loader() {
            return contact;
          },
          action: async ({ request }) => {
            actionCalled = true;
            actionFormData = await request.formData();
            return contact;
          },
        },
      ], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub initialEntries={["/contacts/contact-123/edit"]} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByLabelText("First Name:");
      });

      const firstName = screen.getByLabelText(
        "First Name:",
      ) as HTMLInputElement;
      await user.clear(firstName);
      await user.type(firstName, "Updated");

      await user.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        assertEquals(actionCalled, true);
      });

      assertExists(actionFormData);
      assertEquals((actionFormData as FormData).get("firstName"), "Updated");
      assertEquals((actionFormData as FormData).get("lastName"), "Doe");
      assertEquals(
        (actionFormData as FormData).get("email"),
        "john@example.com",
      );
    });

    it("should show saving state when action is pending", async () => {
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
      let resolveAction: () => void;

      const Stub = createRoutesStub([
        {
          path: "/contacts/:id/edit",
          default: contactEditRoute.default,
          HydrateFallback: contactEditRoute.HydrateFallback,
          loader() {
            return contact;
          },
          action: () =>
            new Promise<Contact>((resolve) => {
              resolveAction = () => resolve(contact);
            }),
        },
      ], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub initialEntries={["/contacts/contact-123/edit"]} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByLabelText("First Name:");
      });

      await user.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        screen.getByRole("button", { name: "Saving..." });
      });

      resolveAction!();
    });

    it("should allow editing all fields before submission", async () => {
      const contact = createTestContact({
        id: "contact-123",
        phone: "555-0000",
        notes: "Original notes",
      });
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(["contact", "contact-123"], contact);

      const user = userEvent.setup();
      using _fetchStub = stubFetch((input) => {
        if (input.toString().includes("/api/contacts")) {
          return Response.json(contact);
        }
        return new Response("Not Found", { status: 404 });
      });
      let actionFormData: FormData | null = null;

      const Stub = createRoutesStub([
        {
          path: "/contacts/:id/edit",
          default: contactEditRoute.default,
          HydrateFallback: contactEditRoute.HydrateFallback,
          loader() {
            return contact;
          },
          action: async ({ request }) => {
            actionFormData = await request.formData();
            return contact;
          },
        },
      ], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub initialEntries={["/contacts/contact-123/edit"]} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByLabelText("First Name:");
      });

      const firstName = screen.getByLabelText(
        "First Name:",
      ) as HTMLInputElement;
      const lastName = screen.getByLabelText("Last Name:") as HTMLInputElement;
      const email = screen.getByLabelText("Email:") as HTMLInputElement;
      const phone = screen.getByLabelText("Phone:") as HTMLInputElement;
      const notes = screen.getByLabelText("Notes:") as HTMLTextAreaElement;

      await user.clear(firstName);
      await user.type(firstName, "NewFirst");
      await user.clear(lastName);
      await user.type(lastName, "NewLast");
      await user.clear(email);
      await user.type(email, "new@example.com");
      await user.clear(phone);
      await user.type(phone, "555-9999");
      await user.clear(notes);
      await user.type(notes, "Updated notes");

      await user.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        assertExists(actionFormData);
        assertEquals(actionFormData.get("firstName"), "NewFirst");
        assertEquals(actionFormData.get("lastName"), "NewLast");
        assertEquals(actionFormData.get("email"), "new@example.com");
        assertEquals(actionFormData.get("phone"), "555-9999");
        assertEquals(actionFormData.get("notes"), "Updated notes");
      });
    });
  });
});
