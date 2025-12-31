import "@udibo/juniper/utils/global-jsdom";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as blogMain from "./main.tsx";

describe("Blog layout route", () => {
  afterEach(cleanup);

  it("should render the Blog heading", () => {
    const Stub = createRoutesStub([{
      ...blogMain,
      path: "/blog",
    }]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Blog" });
  });

  it("should have a link back to home", () => {
    const Stub = createRoutesStub([{
      ...blogMain,
      path: "/blog",
    }]);
    render(<Stub />);

    const link = screen.getByRole("link", { name: "← Home" });
    assertEquals(link.getAttribute("href"), "/");
  });
});
