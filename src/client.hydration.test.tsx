import "@udibo/juniper/utils/global-jsdom";

import {
  assert,
  assertEquals,
  assertExists,
  assertFalse,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { waitFor } from "@testing-library/react";
import globalJsdom from "global-jsdom";
import { act, useEffect } from "react";
import { renderToString } from "react-dom/server";

import { Client } from "@udibo/juniper/client";
import type { DeferredDataOptions, RootRouteModule } from "@udibo/juniper";

import { App, registerRouter } from "./_client.tsx";
import { simulateBrowser } from "./utils/testing.internal.ts";

for (const lazy of [false, true]) {
  it(
    `captures served edits at scheduled hydration for a ${
      lazy ? "lazy" : "eager"
    } root`,
    simulateBrowser({ matches: [{ id: "/" }] }, async () => {
      const cleanup = globalJsdom(undefined, { url: "http://localhost:8000/" });
      let scheduled: IdleRequestCallback | undefined;
      const previousIdle = globalThis.requestIdleCallback;
      globalThis.requestIdleCallback = (callback) => {
        scheduled = callback;
        return 1;
      };
      let capture = "";
      let calls = 0;
      let cleanups = 0;
      let loads = 0;
      const route = {
        default: () => (
          <textarea
            defaultValue="seed"
            ref={(node) => {
              if (node && capture) node.value = capture;
            }}
          />
        ),
        beforeHydrate(doc: Document): () => void {
          calls++;
          capture = doc.querySelector("textarea")!.value;
          return () => {
            cleanups++;
          };
        },
      } satisfies RootRouteModule;
      const client = new Client({
        path: "/",
        main: lazy
          ? () => {
            loads++;
            return Promise.resolve(route);
          }
          : route,
      });
      document.documentElement.innerHTML = renderToString(
        <App>
          <route.default />
        </App>,
      ).replace(/^<html[^>]*>|<\/html>$/g, "");
      try {
        await client.hydrate();
        assertEquals(calls, 0);
        assertExists(scheduled);
        const textarea = document.querySelector("textarea")!;
        textarea.value = "typed while idle";
        await act(() =>
          scheduled!({ didTimeout: false, timeRemaining: () => 50 })
        );
        assertEquals(calls, 1);
        assertEquals(capture, "typed while idle");
        assert(document.querySelector("textarea") === textarea);
        assertEquals(textarea.value, "typed while idle");
        assertEquals(loads, lazy ? 1 : 0);
        document.defaultView!.dispatchEvent(
          new document.defaultView!.PageTransitionEvent("pagehide", {
            persisted: true,
          }),
        );
        assertEquals(cleanups, 0);
        document.defaultView!.dispatchEvent(
          new document.defaultView!.PageTransitionEvent("pagehide", {
            persisted: false,
          }),
        );
        document.defaultView!.dispatchEvent(
          new document.defaultView!.PageTransitionEvent("pagehide", {
            persisted: false,
          }),
        );
        assertEquals(cleanups, 1);
      } finally {
        if (previousIdle) globalThis.requestIdleCallback = previousIdle;
        else Reflect.deleteProperty(globalThis, "requestIdleCallback");
        registerRouter(undefined);
        document.defaultView!.close();
        cleanup();
      }
    }),
  );
}

for (const failure of ["caught", "uncaught", "hook"] as const) {
  it(
    `handles ${failure} failure at hydration without discarding recoverable work`,
    simulateBrowser({ matches: [{ id: "/" }] }, async () => {
      const cleanup = globalJsdom(undefined, { url: "http://localhost:8000/" });
      using _errors = stub(console, "error", () => {});
      let scheduled: IdleRequestCallback | undefined;
      const previousIdle = globalThis.requestIdleCallback;
      globalThis.requestIdleCallback = (callback) => {
        scheduled = callback;
        return 1;
      };
      let cleanups = 0;
      let renders = 0;
      let fail = false;
      const route: RootRouteModule = {
        default: () => {
          renders++;
          if (fail && failure === "caught") throw new Error("route failed");
          return <p>Served</p>;
        },
        ErrorBoundary: () => <p>Recovered</p>,
        beforeHydrate: () => {
          if (failure === "hook") throw new Error("capture failed");
          return () => {
            cleanups++;
          };
        },
      };
      const client = new Client({ path: "/", main: route });
      if (failure === "uncaught") {
        client.htmlProps = {
          get lang(): string {
            throw new Error("document props failed");
          },
        };
      }
      document.documentElement.innerHTML = renderToString(
        <App>
          <p>Served</p>
        </App>,
      ).replace(/^<html[^>]*>|<\/html>$/g, "");
      try {
        await client.hydrate();
        assertExists(scheduled);
        fail = true;
        const hydrate = () =>
          scheduled!({ didTimeout: false, timeRemaining: () => 50 });
        if (failure === "hook") {
          assertThrows(hydrate, Error, "capture failed");
          assertEquals(renders, 0);
          assertEquals(document.querySelector("p")?.textContent, "Served");
        } else {
          hydrate();
          if (failure === "caught") {
            await waitFor(() =>
              assertEquals(
                document.querySelector("p")?.textContent,
                "Recovered",
              )
            );
            assertEquals(cleanups, 0);
          } else {
            await waitFor(() => assertEquals(cleanups, 1));
          }
          document.defaultView!.dispatchEvent(
            new document.defaultView!.PageTransitionEvent("pagehide", {
              persisted: false,
            }),
          );
          assertEquals(cleanups, 1);
        }
      } finally {
        if (previousIdle) globalThis.requestIdleCallback = previousIdle;
        else Reflect.deleteProperty(globalThis, "requestIdleCallback");
        registerRouter(undefined);
        document.defaultView!.close();
        cleanup();
      }
    }),
  );
}

for (
  const { label, url, deferredData, expected } of [
    {
      label: "enabled over HTTP",
      url: "http://localhost:8000/",
      deferredData: { streamOnlyWithJavaScript: true },
      expected: ["juniper_js=1; Path=/; Max-Age=31536000; SameSite=Lax"],
    },
    {
      label: "enabled over HTTPS under a configured name",
      url: "https://example.com/",
      deferredData: { streamOnlyWithJavaScript: true, cookieName: "js" },
      expected: ["js=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure"],
    },
    {
      label: "disabled",
      url: "http://localhost:8000/",
      deferredData: { streamOnlyWithJavaScript: false },
      expected: [],
    },
    {
      label: "absent",
      url: "http://localhost:8000/",
      deferredData: undefined,
      expected: [],
    },
  ] satisfies {
    label: string;
    url: string;
    deferredData?: DeferredDataOptions;
    expected: string[];
  }[]
) {
  it(
    `writes the JavaScript cookie only once hydration commits when the option is ${label}`,
    simulateBrowser({ matches: [{ id: "/" }] }, async () => {
      const cleanup = globalJsdom(undefined, { url });
      let scheduled: IdleRequestCallback | undefined;
      const previousIdle = globalThis.requestIdleCallback;
      globalThis.requestIdleCallback = (callback) => {
        scheduled = callback;
        return 1;
      };
      const cookie = Object.getOwnPropertyDescriptor(
        document.defaultView!.Document.prototype,
        "cookie",
      )!;
      const writes: string[] = [];
      Object.defineProperty(document, "cookie", {
        configurable: true,
        get: () => cookie.get!.call(document),
        set: (value: string) => {
          writes.push(value);
          cookie.set!.call(document, value);
        },
      });
      let mounted = 0;
      const route = {
        default: () => {
          useEffect(() => {
            mounted++;
          }, []);
          return <p>Served</p>;
        },
        deferredData,
      } satisfies RootRouteModule;
      const client = new Client({ path: "/", main: route });
      document.documentElement.innerHTML = renderToString(
        <App>
          <p>Served</p>
        </App>,
      ).replace(/^<html[^>]*>|<\/html>$/g, "");
      try {
        await client.hydrate();
        assertExists(scheduled);
        assertEquals(writes, [], "the cookie was written before hydration");
        await act(() =>
          scheduled!({ didTimeout: false, timeRemaining: () => 50 })
        );
        await waitFor(() => assert(mounted > 0, "hydration never committed"));
        assertEquals([...new Set(writes)], expected);
        if (expected.length > 0 && url.startsWith("http:")) {
          assertStringIncludes(document.cookie, "juniper_js=1");
        }
      } finally {
        if (previousIdle) globalThis.requestIdleCallback = previousIdle;
        else Reflect.deleteProperty(globalThis, "requestIdleCallback");
        registerRouter(undefined);
        document.defaultView!.close();
        cleanup();
      }
    }),
  );
}

it(
  "does not write the JavaScript cookie when hydration fails",
  simulateBrowser({ matches: [{ id: "/" }] }, async () => {
    const cleanup = globalJsdom(undefined, { url: "http://localhost:8000/" });
    using errors = stub(console, "error", () => {});
    let scheduled: IdleRequestCallback | undefined;
    const previousIdle = globalThis.requestIdleCallback;
    globalThis.requestIdleCallback = (callback) => {
      scheduled = callback;
      return 1;
    };
    const client = new Client({
      path: "/",
      main: {
        default: () => <p>Served</p>,
        deferredData: { streamOnlyWithJavaScript: true },
      },
    });
    client.htmlProps = {
      get lang(): string {
        throw new Error("document props failed");
      },
    };
    document.documentElement.innerHTML = renderToString(
      <App>
        <p>Served</p>
      </App>,
    ).replace(/^<html[^>]*>|<\/html>$/g, "");
    try {
      await client.hydrate();
      assertExists(scheduled);
      scheduled({ didTimeout: false, timeRemaining: () => 50 });
      await waitFor(() =>
        assert(
          errors.calls.some((call) =>
            call.args[0] === "hydrate onUncaughtError"
          ),
          "hydration did not fail",
        )
      );
      assertFalse(document.cookie.includes("juniper_js"));
    } finally {
      if (previousIdle) globalThis.requestIdleCallback = previousIdle;
      else Reflect.deleteProperty(globalThis, "requestIdleCallback");
      registerRouter(undefined);
      document.defaultView!.close();
      cleanup();
    }
  }),
);
