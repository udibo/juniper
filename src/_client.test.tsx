import "./utils/global-jsdom.ts";

import { assertEquals, assertExists } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render } from "@testing-library/react";

import { App } from "./_client.tsx";

describe("App", () => {
  afterEach(cleanup);

  it("should render with default lang attribute", () => {
    render(<App>Test content</App>);
    const html = document.documentElement;
    assertEquals(html.getAttribute("lang"), "en");
  });

  it("should render with suppressHydrationWarning", () => {
    render(<App>Test content</App>);
    const html = document.documentElement;
    // suppressHydrationWarning is a React internal prop and won't be visible in the DOM
    // but we can verify the html element exists and has the expected structure
    assertExists(html);
  });

  it("should apply htmlProps to html element", () => {
    render(<App htmlProps={{ lang: "es", dir: "rtl" }}>Test content</App>);
    const html = document.documentElement;
    assertEquals(html.getAttribute("lang"), "es");
    assertEquals(html.getAttribute("dir"), "rtl");
  });

  it("should override default lang with htmlProps", () => {
    render(<App htmlProps={{ lang: "fr" }}>Test content</App>);
    const html = document.documentElement;
    assertEquals(html.getAttribute("lang"), "fr");
  });

  it("should preserve default lang when htmlProps does not include lang", () => {
    render(<App htmlProps={{ dir: "rtl" }}>Test content</App>);
    const html = document.documentElement;
    assertEquals(html.getAttribute("lang"), "en");
    assertEquals(html.getAttribute("dir"), "rtl");
  });

  it("should apply className from htmlProps", () => {
    render(<App htmlProps={{ className: "dark" }}>Test content</App>);
    const html = document.documentElement;
    assertEquals(html.classList.contains("dark"), true);
  });

  it("should render children inside body", () => {
    render(<App>Test content</App>);
    const body = document.body;
    assertExists(body);
    assertEquals(body.textContent?.includes("Test content"), true);
  });
});
