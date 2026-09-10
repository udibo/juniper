/**
 * This module sets up global JSDOM for testing React components.
 *
 * Any test files for react components should import `@udibo/juniper/utils/global-jsdom`
 * at the top and it must be imported before `@testing-library/react`.
 *
 * This module automatically:
 * - Registers JSDOM globals (document, window, etc.) at `http://localhost:8000`,
 *   using the port from `DENO_SERVE_ADDRESS` when present
 * - Stubs FormData to work with JSDOM form elements
 * - Stubs `ResizeObserver`, which JSDOM does not implement, so that libraries
 *   which measure elements (Headless UI, Floating UI, TanStack Virtual) can run
 *   under test instead of throwing a `ReferenceError` from an event handler
 *
 * The `ResizeObserver` stub never reports a resize. A test that asserts on
 * measured layout should drive the measurement itself rather than expect one.
 *
 * Setup lasts for the test module's process; there is no per-test teardown.
 * Use `global-jsdom` directly when you need a different URL or explicit teardown,
 * and pair it with `stubFormData` from `@udibo/juniper/utils/testing`.
 *
 * @example
 * ```tsx
 * import "@udibo/juniper/utils/global-jsdom";
 * import { cleanup, render, screen } from "@testing-library/react";
 * import { afterEach, it } from "@std/testing/bdd";
 * import { assertEquals } from "@std/assert";
 * afterEach(cleanup);
 * it("renders the heading", () => {
 *   render(<h1>Welcome</h1>);
 *   assertEquals(screen.getByRole("heading").textContent, "Welcome");
 * });
 * ```
 *
 * @module utils/global-jsdom
 */

import globalJsdom from "global-jsdom";
import { stubFormData } from "./testing.ts";

const address = Deno.env.get("DENO_SERVE_ADDRESS");
let port = 8000;
if (address) {
  const match = address.match(/:(\d+)$/);
  if (match) {
    port = parseInt(match[1], 10);
  }
}

globalJsdom(undefined, {
  url: `http://localhost:${port}`,
  pretendToBeVisual: true,
});

class NoopResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = NoopResizeObserver;
}

stubFormData();
