import "@udibo/juniper/utils/global-jsdom";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as routingIndex from "./index.tsx";

describe("RoutingIndex route", () => {
  afterEach(cleanup);

  it("should render the index route page", () => {
    const Stub = createRoutesStub([routingIndex]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Index Route" });
    screen.getByText(/An index route is the default route for a directory/);
  });

  it("should show the Index Route feature badge", () => {
    const Stub = createRoutesStub([routingIndex]);
    render(<Stub />);

    const badges = screen.getAllByText("Index Route");
    assertEquals(badges.length, 2);
  });

  it("should display code blocks with file structure", () => {
    const Stub = createRoutesStub([routingIndex]);
    render(<Stub />);

    screen.getByText(/index\.tsx.*← You are here/);
  });
});
