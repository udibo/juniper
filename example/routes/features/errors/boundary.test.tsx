import "@udibo/juniper/utils/global-jsdom";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as boundaryRoute from "./boundary.tsx";

describe("ErrorBoundaryDemo route", () => {
  afterEach(cleanup);

  it("should render the error boundary page", () => {
    const Stub = createRoutesStub([boundaryRoute]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Error Boundary" });
    screen.getByText(/Error boundaries catch JavaScript errors/);
  });

  it("should display the Error Boundary heading", () => {
    const Stub = createRoutesStub([boundaryRoute]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Error Boundary" });
  });

  it("should have a button to trigger an error", () => {
    const Stub = createRoutesStub([boundaryRoute]);
    render(<Stub />);

    screen.getByRole("button", { name: "Throw Error" });
  });

  it("should explain how error boundaries work", () => {
    const Stub = createRoutesStub([boundaryRoute]);
    render(<Stub />);

    screen.getByText("How It Works");
    screen.getByText(
      /When an error occurs in child routes, the boundary catches it/,
    );
    screen.getByText(/The boundary displays your custom error UI/);
  });
});
