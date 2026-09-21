import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import type { ClientGlobals } from "../_client.tsx";
import { deferredHydrationQueue, whenParsed } from "./_env.ts";
import type { ParsingDocument } from "./_env.ts";

function fakeDocument(readyState: DocumentReadyState) {
  const listeners: { type: string; once: boolean; listener: () => void }[] = [];
  const document = {
    readyState,
    addEventListener(
      type: string,
      listener: () => void,
      options?: AddEventListenerOptions,
    ) {
      listeners.push({ type, once: options?.once === true, listener });
    },
  } as unknown as ParsingDocument;
  return { document, listeners };
}

describe("whenParsed", () => {
  it("waits for DOMContentLoaded while the document is still loading", () => {
    const { document, listeners } = fakeDocument("loading");
    let calls = 0;
    whenParsed(document, () => calls++);
    assertEquals(calls, 0);
    assertEquals(
      listeners.map(({ type, once }) => ({ type, once })),
      [{ type: "DOMContentLoaded", once: true }],
    );
    listeners[0].listener();
    assertEquals(calls, 1);
  });

  for (const readyState of ["interactive", "complete"] as const) {
    it(`runs at once when the document is ${readyState}`, () => {
      const { document, listeners } = fakeDocument(readyState);
      let calls = 0;
      whenParsed(document, () => calls++);
      assertEquals(calls, 1);
      assertEquals(listeners.length, 0);
    });
  }

  it("never runs without a document", () => {
    let calls = 0;
    whenParsed(undefined, () => calls++);
    assertEquals(calls, 0);
  });
});

describe("deferredHydrationQueue", () => {
  it("creates the queue on the scope and returns the same array afterwards", () => {
    const scope: ClientGlobals = {};
    const queue = deferredHydrationQueue(scope);
    assert(Array.isArray(queue));
    assert(scope.__juniperDeferredHydration === queue);
    assert(deferredHydrationQueue(scope) === queue);
  });

  it("keeps entries pushed before the client reads the queue", () => {
    const pushed = [{ id: "p0", status: "resolved", value: 1 }];
    const scope: ClientGlobals = { __juniperDeferredHydration: pushed };
    assert(deferredHydrationQueue(scope) === pushed);
  });

  for (
    const [name, clobbered] of [
      ["an element", { tagName: "A", id: "__juniperDeferredHydration" }],
      ["an element collection", { length: 2, item: () => null }],
    ] as const
  ) {
    it(`replaces ${name} left by DOM clobbering with a fresh array`, () => {
      const scope = {
        __juniperDeferredHydration: clobbered,
      } as unknown as ClientGlobals;
      const queue = deferredHydrationQueue(scope);
      assert(Array.isArray(queue));
      assertEquals(queue.length, 0);
      assert(scope.__juniperDeferredHydration === queue);
    });
  }
});
