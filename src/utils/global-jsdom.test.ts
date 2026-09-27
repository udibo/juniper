import "./global-jsdom.ts";

import { assert, assertEquals, assertInstanceOf } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

describe("global-jsdom", () => {
  it("uses the document's storage for browser globals", () => {
    assertEquals(globalThis.localStorage, document.defaultView!.localStorage);
    assertEquals(
      globalThis.sessionStorage,
      document.defaultView!.sessionStorage,
    );
    localStorage.setItem("browser-storage-test", "local");
    sessionStorage.setItem("browser-storage-test", "session");
    assertEquals(
      document.defaultView!.localStorage.getItem("browser-storage-test"),
      "local",
    );
    assertEquals(
      document.defaultView!.sessionStorage.getItem("browser-storage-test"),
      "session",
    );
    localStorage.removeItem("browser-storage-test");
    sessionStorage.removeItem("browser-storage-test");
  });

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
