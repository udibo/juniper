/**
 * This module sets up global JSDOM for testing React components.
 *
 * Any test files for react components should import `@udibo/juniper/utils/global-jsdom`
 * at the top and it must be imported before `@testing-library/react`.
 *
 * This module automatically:
 * - Registers JSDOM globals (document, window, etc.) with the correct localhost URL
 * - Stubs FormData to work with JSDOM form elements
 * - Stubs `ResizeObserver`, which JSDOM does not implement, so that libraries
 *   which measure elements (Headless UI, Floating UI, TanStack Virtual) can run
 *   under test instead of throwing a `ReferenceError` from an event handler
 *
 * The `ResizeObserver` stub never reports a resize. A test that asserts on
 * measured layout should drive the measurement itself rather than expect one.
 *
 * The only reason to use `npm:global-jsdom` directly instead is if you need a URL
 * other than localhost. If you do that, you should also call `stubFormData` from
 * `@udibo/juniper/utils/testing` since `npm:global-jsdom` will not automatically stub it.
 *
 * @module utils/global-jsdom
 */

import globalJsdom from "global-jsdom";
import { stubFormData } from "./testing.ts";

// DENO_SERVE_ADDRESS format: "tcp:0.0.0.0:8000".
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

// Stubbed globally and never restored.
stubFormData();
