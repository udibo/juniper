import "@udibo/juniper/utils/global-jsdom";

import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { waitFor } from "@testing-library/react";
import globalJsdom from "global-jsdom";
import { act } from "react";
import { renderToString } from "react-dom/server";

import { Client } from "@udibo/juniper/client";
import type { RootRouteModule } from "@udibo/juniper";

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
