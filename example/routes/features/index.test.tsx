import "@udibo/juniper/utils/global-jsdom";

import { assertEquals } from "@std/assert";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as featuresIndex from "./index.tsx";

describe("FeaturesIndex route", () => {
  afterEach(cleanup);

  it("should render the features index page", () => {
    const Stub = createRoutesStub([featuresIndex]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Explore Juniper Features" });
    screen.getByText(/Select a feature from the sidebar/);
  });

  it("should have a link to start with routing", () => {
    const Stub = createRoutesStub([featuresIndex]);
    render(<Stub />);

    const link = screen.getByRole("link", { name: /Start with Routing/ });
    assertEquals(link.getAttribute("href"), "/features/routing");
  });
});
