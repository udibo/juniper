/**
 * This module sets up global JSDOM for testing React components.
 *
 * Any test files for react components should import `@udibo/juniper/utils/global-jsdom`
 * at the top and it must be imported before `@testing-library/react`.
 *
 * This module automatically:
 * - Registers JSDOM globals (document, window, etc.) with the correct localhost URL
 * - Stubs FormData to work with JSDOM form elements
 *
 * The only reason to use `npm:global-jsdom` directly instead is if you need a URL
 * other than localhost. If you do that, you should also call `stubFormData` from
 * `@udibo/juniper/utils/testing` since `npm:global-jsdom` will not automatically stub it.
 *
 * @module utils/global-jsdom
 */

import globalJsdom from "global-jsdom";
import { stubFormData } from "./testing.ts";

// Parse port from DENO_SERVE_ADDRESS (format: "tcp:0.0.0.0:8100") or default to 8000
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

// Stub FormData globally - this is never restored
stubFormData();
