import "@udibo/juniper/utils/global-jsdom";

import { assertEquals } from "@std/assert";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it } from "@std/testing/bdd";

import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as indexRoute from "./index.tsx";

describe("Home page route", () => {
  afterEach(cleanup);

  it("should render the welcome heading", () => {
    const Stub = createRoutesStub([indexRoute]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Welcome to Juniper" });
  });

  it("should render the tagline", () => {
    const Stub = createRoutesStub([indexRoute]);
    render(<Stub />);

    screen.getByText(
      /A modern web framework for building React applications with Deno/,
    );
  });

  it("should have documentation link", () => {
    const Stub = createRoutesStub([indexRoute]);
    render(<Stub />);

    const link = screen.getByRole("link", { name: "Documentation" });
    assertEquals(link.getAttribute("href"), "https://jsr.io/@udibo/juniper");
  });

  it("should have features demo link", () => {
    const Stub = createRoutesStub([indexRoute]);
    render(<Stub />);

    const link = screen.getByRole("link", { name: "Features Demo" });
    assertEquals(link.getAttribute("href"), "/features");
  });

  it("should have example blog link", () => {
    const Stub = createRoutesStub([indexRoute]);
    render(<Stub />);

    const link = screen.getByRole("link", { name: "Example Blog" });
    assertEquals(link.getAttribute("href"), "/blog");
  });

  it("should render the why juniper section", () => {
    const Stub = createRoutesStub([indexRoute]);
    render(<Stub />);

    screen.getByRole("heading", { name: "Why Juniper?" });
    screen.getByRole("heading", { name: "File-Based Routing" });
    screen.getByRole("heading", { name: "Server-Side Rendering" });
    screen.getByRole("heading", { name: "Hot Reloading" });
  });
});
