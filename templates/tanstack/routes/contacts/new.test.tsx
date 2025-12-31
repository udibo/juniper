import "@udibo/juniper/utils/global-jsdom";

import { assertEquals, assertExists } from "@std/assert";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, it } from "@std/testing/bdd";
import type { RouterContextProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  createRoutesStub,
  fetchResolver,
  stubFetch,
} from "@udibo/juniper/utils/testing";

import { queryClientContext } from "@/context/query.ts";
import type { Contact } from "@/services/contact.ts";
import * as newContactRoute from "./new.tsx";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function getContext(queryClient: QueryClient) {
  return (context: RouterContextProvider) => {
    context.set(queryClientContext, queryClient);
  };
}

describe("New contact route", () => {
  afterEach(cleanup);

  describe("rendering", () => {
    it("should render the new contact heading", async () => {
      const queryClient = createTestQueryClient();
      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("heading", { name: "New Contact" });
      });
    });

    it("should have back to contacts link", async () => {
      const queryClient = createTestQueryClient();
      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("link", { name: "← Back to Contacts" });
      });
      const link = screen.getByRole("link", { name: "← Back to Contacts" });
      assertEquals(link.getAttribute("href"), "/contacts");
    });

    it("should display form with all fields", async () => {
      const queryClient = createTestQueryClient();
      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
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

    it("should have create contact button", async () => {
      const queryClient = createTestQueryClient();
      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("button", { name: "Create Contact" });
      });
    });

    it("should have useMutation section heading", async () => {
      const queryClient = createTestQueryClient();
      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("heading", { name: "Using useMutation" });
      });
    });

    it("should have server action form section", async () => {
      const queryClient = createTestQueryClient();
      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("heading", { name: "Using Server Action Form" });
      });
      screen.getByRole("button", { name: "Create via Server Action" });
    });

    it("should have required attribute on name and email fields", async () => {
      const queryClient = createTestQueryClient();
      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
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

      assertEquals(firstName.required, true);
      assertEquals(lastName.required, true);
      assertEquals(email.required, true);
    });

    it("should not require phone and notes fields", async () => {
      const queryClient = createTestQueryClient();
      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
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
  });

  describe("useMutation form", () => {
    it("should allow filling in the form fields", async () => {
      const queryClient = createTestQueryClient();
      const user = userEvent.setup();
      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
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

      await user.type(firstName, "John");
      await user.type(lastName, "Doe");
      await user.type(email, "john@example.com");
      await user.type(phone, "555-1234");
      await user.type(notes, "Test notes");

      assertEquals(firstName.value, "John");
      assertEquals(lastName.value, "Doe");
      assertEquals(email.value, "john@example.com");
      assertEquals(phone.value, "555-1234");
      assertEquals(notes.value, "Test notes");
    });

    it("should show creating state when mutation is pending", async () => {
      const queryClient = createTestQueryClient();
      const user = userEvent.setup();
      const [resolveFetch, fakeFetch] = fetchResolver();
      using _fetchStub = stubFetch(fakeFetch);

      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByLabelText("First Name:");
      });

      await user.type(screen.getByLabelText("First Name:"), "John");
      await user.type(screen.getByLabelText("Last Name:"), "Doe");
      await user.type(screen.getByLabelText("Email:"), "john@example.com");

      await user.click(
        screen.getByRole("button", { name: "Create Contact" }),
      );

      await waitFor(() => {
        screen.getByRole("button", { name: "Creating..." });
      });

      resolveFetch(
        Response.json({
          id: "new-id",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );
    });

    it("should display error message when mutation fails", async () => {
      const queryClient = createTestQueryClient();
      const user = userEvent.setup();
      using _fetchStub = stubFetch(
        new Response(
          JSON.stringify({ message: "Email already exists" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      );

      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByLabelText("First Name:");
      });

      await user.type(screen.getByLabelText("First Name:"), "John");
      await user.type(screen.getByLabelText("Last Name:"), "Doe");
      await user.type(screen.getByLabelText("Email:"), "john@example.com");

      await user.click(
        screen.getByRole("button", { name: "Create Contact" }),
      );

      await waitFor(() => {
        screen.getByText(/Error creating contact/);
      });
    });

    it("should create contact successfully and navigate", async () => {
      const queryClient = createTestQueryClient();
      const user = userEvent.setup();
      const createdContact: Contact = {
        id: "new-contact-123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      using _fetchStub = stubFetch(Response.json(createdContact));

      const Stub = createRoutesStub([
        {
          ...newContactRoute,
          path: "/contacts/new",
        },
        {
          path: "/contacts/:id",
          default: () => <div>Contact Page: {createdContact.id}</div>,
        },
      ], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByLabelText("First Name:");
      });

      await user.type(screen.getByLabelText("First Name:"), "John");
      await user.type(screen.getByLabelText("Last Name:"), "Doe");
      await user.type(screen.getByLabelText("Email:"), "john@example.com");

      await user.click(
        screen.getByRole("button", { name: "Create Contact" }),
      );

      await waitFor(() => {
        screen.getByText(`Contact Page: ${createdContact.id}`);
      });
    });
  });

  describe("server action form", () => {
    it("should allow filling in the server action form fields", async () => {
      const queryClient = createTestQueryClient();
      const user = userEvent.setup();
      const Stub = createRoutesStub([{
        ...newContactRoute,
        path: "/contacts/new",
      }], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("heading", { name: "Using Server Action Form" });
      });

      const serverActionForm = screen.getByRole("button", {
        name: "Create via Server Action",
      }).closest("form");
      assertExists(serverActionForm);

      const firstNameInput = serverActionForm.querySelector(
        'input[name="firstName"]',
      ) as HTMLInputElement;
      const lastNameInput = serverActionForm.querySelector(
        'input[name="lastName"]',
      ) as HTMLInputElement;
      const emailInput = serverActionForm.querySelector(
        'input[name="email"]',
      ) as HTMLInputElement;

      await user.type(firstNameInput, "Jane");
      await user.type(lastNameInput, "Smith");
      await user.type(emailInput, "jane@example.com");

      assertEquals(firstNameInput.value, "Jane");
      assertEquals(lastNameInput.value, "Smith");
      assertEquals(emailInput.value, "jane@example.com");
    });

    it("should call action when server action form is submitted", async () => {
      const queryClient = createTestQueryClient();
      const user = userEvent.setup();
      let actionCalled = false;
      let actionFormData: FormData | null = null;

      const Stub = createRoutesStub([
        {
          ...newContactRoute,
          path: "/contacts/new",
          action: async ({ request }) => {
            actionCalled = true;
            actionFormData = await request.formData();
            return new Response(null, {
              status: 302,
              headers: { Location: "/contacts/new-id" },
            });
          },
        },
        {
          path: "/contacts/:id",
          default: () => <div>Contact Page</div>,
        },
      ], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("heading", { name: "Using Server Action Form" });
      });

      const serverActionForm = screen.getByRole("button", {
        name: "Create via Server Action",
      }).closest("form");
      assertExists(serverActionForm);

      const firstNameInput = serverActionForm.querySelector(
        'input[name="firstName"]',
      ) as HTMLInputElement;
      const lastNameInput = serverActionForm.querySelector(
        'input[name="lastName"]',
      ) as HTMLInputElement;
      const emailInput = serverActionForm.querySelector(
        'input[name="email"]',
      ) as HTMLInputElement;

      await user.type(firstNameInput, "Jane");
      await user.type(lastNameInput, "Smith");
      await user.type(emailInput, "jane@example.com");

      await user.click(
        screen.getByRole("button", { name: "Create via Server Action" }),
      );

      await waitFor(() => {
        assertEquals(actionCalled, true);
      });

      assertExists(actionFormData);
      assertEquals((actionFormData as FormData).get("firstName"), "Jane");
      assertEquals((actionFormData as FormData).get("lastName"), "Smith");
      assertEquals(
        (actionFormData as FormData).get("email"),
        "jane@example.com",
      );
    });

    it("should show submitting state when action is pending", async () => {
      const queryClient = createTestQueryClient();
      const user = userEvent.setup();
      let resolveAction: () => void;

      const Stub = createRoutesStub([
        {
          ...newContactRoute,
          path: "/contacts/new",
          action: () =>
            new Promise<Response>((resolve) => {
              resolveAction = () =>
                resolve(
                  new Response(null, {
                    status: 302,
                    headers: { Location: "/contacts/new-id" },
                  }),
                );
            }),
        },
        {
          path: "/contacts/:id",
          default: () => <div>Contact Page</div>,
        },
      ], { getContext: getContext(queryClient) });
      render(
        <QueryClientProvider client={queryClient}>
          <Stub />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        screen.getByRole("heading", { name: "Using Server Action Form" });
      });

      const serverActionForm = screen.getByRole("button", {
        name: "Create via Server Action",
      }).closest("form");
      assertExists(serverActionForm);

      const firstNameInput = serverActionForm.querySelector(
        'input[name="firstName"]',
      ) as HTMLInputElement;
      const lastNameInput = serverActionForm.querySelector(
        'input[name="lastName"]',
      ) as HTMLInputElement;
      const emailInput = serverActionForm.querySelector(
        'input[name="email"]',
      ) as HTMLInputElement;

      await user.type(firstNameInput, "Jane");
      await user.type(lastNameInput, "Smith");
      await user.type(emailInput, "jane@example.com");

      await user.click(
        screen.getByRole("button", { name: "Create via Server Action" }),
      );

      await waitFor(() => {
        screen.getByRole("button", { name: "Creating..." });
      });

      resolveAction!();

      await waitFor(() => {
        screen.getByText("Contact Page");
      });
    });
  });
});
