import "./global-jsdom.ts";

import { assert, assertEquals, assertInstanceOf } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

describe("global-jsdom", () => {
  it("defines ResizeObserver, which JSDOM omits", () => {
    assert(
      "ResizeObserver" in globalThis,
      "libraries that measure elements construct one during ordinary interaction",
    );

    const observer = new ResizeObserver(() => {});
    assertInstanceOf(observer.observe, Function);
    assertInstanceOf(observer.unobserve, Function);
    assertInstanceOf(observer.disconnect, Function);
  });

  it("leaves observing an element inert rather than reporting a resize", () => {
    let reported = false;
    const observer = new ResizeObserver(() => {
      reported = true;
    });

    observer.observe(globalThis.document.body);
    observer.disconnect();

    assertEquals(reported, false);
  });
});
