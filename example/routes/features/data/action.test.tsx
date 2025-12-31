import "@udibo/juniper/utils/global-jsdom";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as actionRoute from "./action.tsx";

describe("FormActionDemo route", () => {
  afterEach(cleanup);

  it("should render the form action page", () => {
    const Stub = createRoutesStub([actionRoute]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Form Action" });
    screen.getByText(/Actions handle form submissions/);
  });

  it("should display the form with name and email inputs", () => {
    const Stub = createRoutesStub([actionRoute]);
    render(<Stub />);

    screen.getByLabelText("Name");
    screen.getByLabelText("Email");
    screen.getByRole("button", { name: "Submit" });
  });

  it("should show placeholder message before submission", () => {
    const Stub = createRoutesStub([actionRoute]);
    render(<Stub />);

    screen.getByText("Submit the form to see the action result");
  });

  it("should render with stubbed action data", () => {
    const Stub = createRoutesStub([{
      ...actionRoute,
      action() {
        return {
          success: true,
          message: "Form submitted successfully!",
          submittedAt: "2025-01-15T12:00:00.000Z",
          formData: { name: "Test User", email: "test@example.com" },
        };
      },
    }]);
    render(<Stub />);

    screen.getByLabelText("Name");
    screen.getByLabelText("Email");
  });
});
