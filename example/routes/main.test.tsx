import "@udibo/juniper/utils/global-jsdom";

import { assertEquals } from "@std/assert";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as mainRoute from "./main.tsx";

describe("Main layout route", () => {
  afterEach(cleanup);

  it("should render the navigation bar", () => {
    const Stub = createRoutesStub([{
      ...mainRoute,
      path: "/",
    }]);
    render(<Stub />);

    screen.getByRole("link", { name: "Juniper" });
    screen.getByRole("link", { name: "Features" });
    screen.getByRole("link", { name: "Blog" });
  });

  it("should have correct navigation link hrefs", () => {
    const Stub = createRoutesStub([{
      ...mainRoute,
      path: "/",
    }]);
    render(<Stub />);

    const juniperLink = screen.getByRole("link", { name: "Juniper" });
    const featuresLink = screen.getByRole("link", { name: "Features" });
    const blogLink = screen.getByRole("link", { name: "Blog" });

    assertEquals(juniperLink.getAttribute("href"), "/");
    assertEquals(featuresLink.getAttribute("href"), "/features");
    assertEquals(blogLink.getAttribute("href"), "/blog");
  });
});
