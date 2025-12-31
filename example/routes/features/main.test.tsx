import "@udibo/juniper/utils/global-jsdom";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as featuresMain from "./main.tsx";

describe("FeaturesLayout route", () => {
  afterEach(cleanup);

  it("should render the features layout with navigation", () => {
    const Stub = createRoutesStub([featuresMain]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Features" });
    screen.getByRole("link", { name: "← Home" });
  });

  it("should display feature group headings in sidebar", () => {
    const Stub = createRoutesStub([featuresMain]);
    render(<Stub />);

    screen.getByText("Routing");
    screen.getByText("Data Loading");
    screen.getByText("Server Loaders");
    screen.getByText("Actions");
    screen.getByText("Server Actions");
    screen.getByText("Error Handling");
  });

  it("should have links to routing features", () => {
    const Stub = createRoutesStub([featuresMain]);
    render(<Stub />);

    screen.getByRole("link", { name: "Index Route" });
    screen.getByRole("link", { name: "Parameterized Route" });
    screen.getByRole("link", { name: "Nested Params" });
    screen.getByRole("link", { name: "Wildcard Route" });
  });

  it("should have links to data loading features", () => {
    const Stub = createRoutesStub([featuresMain]);
    render(<Stub />);

    screen.getByRole("link", { name: "Client Loader" });
    screen.getByRole("link", { name: "Deferred Data" });
    screen.getByRole("link", { name: "Hydrate Fallback" });
  });

  it("should have links to action features", () => {
    const Stub = createRoutesStub([featuresMain]);
    render(<Stub />);

    screen.getByRole("link", { name: "Form Action" });
    screen.getByRole("link", { name: "Fetcher Action" });
  });

  it("should have links to error handling features", () => {
    const Stub = createRoutesStub([featuresMain]);
    render(<Stub />);

    screen.getByRole("link", { name: "Error Boundary" });
    screen.getByRole("link", { name: "SSR Errors" });
  });
});
