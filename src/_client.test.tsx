import "./utils/global-jsdom.ts";

import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { deadline } from "@std/async/deadline";
import { delay } from "@std/async/delay";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterContextProvider,
  RouterProvider,
} from "react-router";

import {
  App,
  createLazyRoute,
  createRoute,
  JuniperContextProvider,
  registerRouter,
  setClientBuildId,
} from "./_client.tsx";

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

describe("Document recovery safety", () => {
  const lazyReloadKey = "__juniper_lazy_load_reload";
  const buildReloadKey = "__juniper_build_skew_reload";
  const sameLocationReloadKey = "__juniper_same_location_reload";
  let originalLocation: Location;
  let assigned: string[];

  beforeEach(() => {
    assigned = [];
    originalLocation = globalThis.location;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        href: "http://localhost/current",
        assign: (url: string) => void assigned.push(url),
        reload: () => void assigned.push("reload"),
      },
    });
    sessionStorage.removeItem(lazyReloadKey);
    sessionStorage.removeItem(buildReloadKey);
    sessionStorage.removeItem(sameLocationReloadKey);
    registerRouter(undefined);
    setClientBuildId(undefined);
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: originalLocation,
    });
    sessionStorage.removeItem(lazyReloadKey);
    sessionStorage.removeItem(buildReloadKey);
    sessionStorage.removeItem(sameLocationReloadKey);
    registerRouter(undefined);
    setClientBuildId(undefined);
  });

  function failingRoute() {
    return createLazyRoute(() => Promise.reject(new Error("chunk missing")));
  }

  for (
    const kind of [
      "lazy loader",
      "lazy action",
      "build",
      "same-location",
    ] as const
  ) {
    for (
      const scenario of [
        "canceled attempts",
        "concurrent attempts",
        "canceled latest attempt",
      ] as const
    ) {
      it(`counts actual ${kind} handoffs after ${scenario}`, async () => {
        using time = new FakeTime();
        const key = kind.startsWith("lazy")
          ? lazyReloadKey
          : kind === "build"
          ? buildReloadKey
          : sameLocationReloadKey;
        if (scenario === "concurrent attempts") {
          sessionStorage.setItem(
            key,
            JSON.stringify({ count: 1, timestamp: Date.now() }),
          );
        }
        setClientBuildId("build-a");
        using _fetch = stub(globalThis, "fetch", () =>
          Promise.resolve(
            kind === "build"
              ? new Response("ok", {
                headers: { "X-Juniper-Build": "build-b" },
              })
              : Response.json({ location: "http://localhost/current" }, {
                headers: { "X-Juniper": "redirect" },
              }),
          ));
        const state = {
          location: { pathname: "/current", search: "", hash: "" },
          navigation: {
            location: { pathname: "/destination", search: "", hash: "" },
          },
        };
        registerRouter({ state });
        const route = kind.startsWith("lazy")
          ? await failingRoute()()
          : createRoute({}, { loader: true }, "/destination");
        const handler = kind === "lazy action" ? route.action : route.loader;
        assertExists(handler);
        const errors: unknown[] = [];
        const outcomes: string[] = [];

        function start(index: number) {
          const controller = new AbortController();
          state.navigation.location.pathname = `/destination-${index}`;
          const request = new Request(`http://localhost/destination-${index}`, {
            method: kind === "lazy action" ? "POST" : "GET",
            signal: controller.signal,
          });
          try {
            Promise.resolve(handler!({
              request,
              context: new RouterContextProvider(),
              params: {},
              url: new URL(request.url),
              pattern: "/destination",
            })).then(
              () => outcomes.push("resolved"),
              (error) => errors.push(error),
            );
          } catch (error) {
            errors.push(error);
          }
          return controller;
        }

        if (scenario === "canceled attempts") {
          for (let index = 0; index < 2; index++) {
            const controller = start(index);
            await time.runMicrotasks();
            controller.abort();
            await time.tickAsync(1);
          }
          assertEquals(assigned, []);
          start(2);
        } else {
          for (let index = 0; index < 4; index++) {
            const controller = start(index);
            await time.runMicrotasks();
            if (scenario === "canceled latest attempt" && index === 3) {
              controller.abort();
            }
          }
        }
        await time.tickAsync(1);
        const destination = `/destination-${
          scenario === "concurrent attempts" ? 3 : 2
        }`;
        assertEquals(errors, []);
        assertEquals(outcomes, []);
        assertEquals(assigned, [
          kind === "same-location"
            ? "reload"
            : kind === "build"
            ? `http://localhost${destination}`
            : destination,
        ]);
        assertEquals(
          JSON.parse(sessionStorage.getItem(key)!).count,
          scenario === "concurrent attempts" ? 2 : 1,
        );
      });
    }
  }

  for (const handler of ["loader", "action"] as const) {
    it(`cancels a scheduled lazy ${handler} recovery when navigation is superseded`, async () => {
      using time = new FakeTime();
      const controller = new AbortController();
      registerRouter({
        state: {
          location: { pathname: "/current", search: "", hash: "" },
          navigation: {
            location: { pathname: "/obsolete", search: "", hash: "" },
          },
        },
      });
      const route = await failingRoute()();
      const recover = route[handler];
      assertExists(recover);
      const request = new Request("http://localhost/obsolete", {
        method: handler === "action" ? "POST" : "GET",
        signal: controller.signal,
      });
      void recover({
        request,
        context: new RouterContextProvider(),
        params: {},
        url: new URL(request.url),
        pattern: "/obsolete",
      });
      controller.abort();
      await time.tickAsync(1);
      assertEquals(assigned, []);
    });

    it(`ignores an already aborted lazy ${handler} without consuming a retry`, async () => {
      using time = new FakeTime();
      const controller = new AbortController();
      registerRouter({
        state: {
          location: { pathname: "/current", search: "", hash: "" },
          navigation: {},
        },
      });
      const route = await failingRoute()();
      const recover = route[handler];
      assertExists(recover);
      controller.abort();
      const request = new Request("http://localhost/obsolete", {
        method: handler === "action" ? "POST" : "GET",
        signal: controller.signal,
      });
      let receivedError: unknown;
      void Promise.resolve().then(() =>
        recover({
          request,
          context: new RouterContextProvider(),
          params: {},
          url: new URL(request.url),
          pattern: "/obsolete",
        })
      ).catch((error) => {
        receivedError = error;
      });
      await time.tickAsync(1);
      assertEquals(assigned, []);
      assertEquals(sessionStorage.getItem(lazyReloadKey), null);
      assertEquals(receivedError, controller.signal.reason);
    });
  }

  it("does not exceed the build retry budget when response cancellation finishes late", async () => {
    using time = new FakeTime();
    setClientBuildId("build-a");
    sessionStorage.setItem(
      buildReloadKey,
      JSON.stringify({ count: 1, timestamp: Date.now() }),
    );
    const cleanup = Promise.withResolvers<void>();
    const firstResponse = new Response("slow cleanup", {
      headers: { "X-Juniper-Build": "build-b" },
    });
    assertExists(firstResponse.body);
    using _cancel = stub(firstResponse.body, "cancel", () => cleanup.promise);
    let fetches = 0;
    using _fetch = stub(globalThis, "fetch", () =>
      Promise.resolve(
        fetches++ === 0 ? firstResponse : new Response("ok", {
          headers: { "X-Juniper-Build": "build-b" },
        }),
      ));
    const outcomes: string[] = [];
    const errors: unknown[] = [];
    for (let index = 0; index < 2; index++) {
      requestData(new AbortController().signal).then(
        () => outcomes.push("resolved"),
        (error) => errors.push(error),
      );
      await time.runMicrotasks();
    }
    await time.tickAsync(1);
    cleanup.resolve();
    await time.tickAsync(1);
    assertEquals(assigned, ["http://localhost/slow"]);
    assertEquals(JSON.parse(sessionStorage.getItem(buildReloadKey)!).count, 2);
    assertEquals(errors, []);
    assertEquals(outcomes, []);
  });

  for (
    const pathname of ["//attacker.example/", "/\\attacker.example/", "/report"]
  ) {
    it(`keeps module-error retries on origin and preserves the URL for ${JSON.stringify(pathname)}`, () => {
      const { middleware: _, ...route } = createRoute({
        ErrorBoundary: ({ resetErrorBoundary }) => (
          <button type="button" onClick={resetErrorBoundary}>Retry</button>
        ),
      });
      const router = createMemoryRouter([{ path: "*", id: "page", ...route }], {
        initialEntries: [`${pathname}?tenant=alpha#section`],
        hydrationData: {
          errors: {
            page: new TypeError("Failed to fetch dynamically imported module"),
          },
        },
      });
      try {
        const view = render(
          <JuniperContextProvider context={new RouterContextProvider()}>
            <RouterProvider router={router} />
          </JuniperContextProvider>,
        );
        fireEvent.click(view.getByRole("button", { name: "Retry" }));
        assertEquals(assigned, [
          pathname === "/report"
            ? "/report?tenant=alpha#section"
            : "http://localhost/current",
        ]);
      } finally {
        router.dispose();
      }
    });
  }

  it("preserves query parameters and the fragment when retrying a route error", async () => {
    const requests: string[] = [];
    const { middleware: _, ...route } = createRoute({
      loader: ({ request }) => {
        requests.push(request.url);
        return "loaded";
      },
      default: ({ loaderData }) => <div>{String(loaderData)}</div>,
      ErrorBoundary: ({ resetErrorBoundary }) => (
        <button type="button" onClick={resetErrorBoundary}>Retry</button>
      ),
    });
    const router = createMemoryRouter([{
      path: "/report",
      id: "page",
      ...route,
    }], {
      initialEntries: ["/report?tenant=alpha#section"],
      hydrationData: { errors: { page: new Error("Temporary failure") } },
    });
    try {
      const view = render(
        <JuniperContextProvider context={new RouterContextProvider()}>
          <RouterProvider router={router} />
        </JuniperContextProvider>,
      );
      await act(() => {
        fireEvent.click(view.getByRole("button", { name: "Retry" }));
      });
      assertEquals(requests, ["http://localhost/report?tenant=alpha"]);
      assertEquals(router.state.location.search, "?tenant=alpha");
      assertEquals(router.state.location.hash, "#section");
      assertEquals(router.state.historyAction, "REPLACE");
      assertEquals(view.getByText("loaded").textContent, "loaded");
    } finally {
      router.dispose();
    }
  });

  it("retries rendering a route without a loader after its component failed", async () => {
    let shouldFail = true;
    using _console = stub(console, "error");
    const { middleware: _, ...route } = createRoute({
      default: () => {
        if (shouldFail) throw new Error("Temporary render failure");
        return <div>Recovered</div>;
      },
      ErrorBoundary: ({ resetErrorBoundary }) => (
        <button type="button" onClick={resetErrorBoundary}>Retry</button>
      ),
    });
    const router = createMemoryRouter([{
      path: "/report",
      id: "page",
      ...route,
    }], {
      initialEntries: ["/report?tenant=alpha#section"],
    });
    try {
      const view = render(
        <JuniperContextProvider context={new RouterContextProvider()}>
          <RouterProvider router={router} />
        </JuniperContextProvider>,
      );
      shouldFail = false;
      await act(() => {
        fireEvent.click(view.getByRole("button", { name: "Retry" }));
      });
      assertEquals(view.getByText("Recovered").textContent, "Recovered");
      assertEquals(router.state.location.search, "?tenant=alpha");
      assertEquals(router.state.location.hash, "#section");
    } finally {
      router.dispose();
    }
  });

  for (const pathname of ["//attacker.example/", "/\\attacker.example/"]) {
    it(`keeps failed-chunk recovery on origin for ${JSON.stringify(pathname)}`, async () => {
      const router = createMemoryRouter([{
        path: "*",
        id: "current",
        Component: () => <div>Current</div>,
      }, {
        path: "/destination",
        lazy: failingRoute(),
      }], { initialEntries: [pathname] });
      registerRouter(router);
      try {
        assertEquals(router.state.location.pathname, pathname);
        void router.fetch("probe", "current", "/destination");
        await delay(10);
        assertEquals(assigned.length, 1);
        assertEquals(
          new URL(assigned[0], "http://localhost/").origin,
          "http://localhost",
        );
      } finally {
        router.dispose();
      }
    });
  }

  it("bounds missing-child recovery even when a parent module loads successfully", async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      await createLazyRoute(() =>
        Promise.resolve({ default: () => <div>Parent</div> })
      )();
      void failingRoute()();
      await delay(10);
      assertEquals(assigned.length, attempt + 1);
    }
    await createLazyRoute(() =>
      Promise.resolve({ default: () => <div>Parent</div> })
    )();
    await assertRejects(
      () => deadline(failingRoute()(), 250),
      Error,
      "chunk missing",
    );
    assertEquals(assigned.length, 2);
  });

  function requestData(signal: AbortSignal) {
    const route = createRoute({}, { loader: true }, "/slow");
    assertExists(route.loader);
    const request = new Request("http://localhost/slow", { signal });
    return Promise.resolve(route.loader({
      request,
      context: {} as never,
      params: {},
      url: new URL(request.url),
      pattern: "/slow",
    }));
  }

  it("passes the navigation abort signal to the data fetch", async () => {
    const controller = new AbortController();
    let fetchSignal: AbortSignal | null | undefined;
    using _fetch = stub(globalThis, "fetch", (_input, init) => {
      fetchSignal = init?.signal;
      return Promise.resolve(new Response("ok"));
    });
    const result = await requestData(controller.signal);
    assert(result instanceof Response);
    assertExists(fetchSignal);
    controller.abort();
    assert(fetchSignal.aborted);
    await result.body?.cancel();
  });

  for (const responseType of ["build", "redirect", "reload"] as const) {
    it(`ignores a late ${responseType} response after navigation was canceled`, async () => {
      const controller = new AbortController();
      const response = Promise.withResolvers<Response>();
      setClientBuildId("build-a");
      using _fetch = stub(globalThis, "fetch", () => response.promise);
      const result = requestData(controller.signal);
      const observed = result.then(() => "resolved", () => "rejected");
      controller.abort();
      response.resolve(
        responseType === "build"
          ? new Response("ok", { headers: { "X-Juniper-Build": "build-b" } })
          : Response.json({
            location: responseType === "reload"
              ? "http://localhost/current"
              : "/replacement",
            reloadDocument: responseType === "redirect",
          }, { headers: { "X-Juniper": "redirect" } }),
      );
      await delay(10);
      assertEquals(assigned, []);
      assertEquals(await deadline(observed, 250), "rejected");
      assertEquals(sessionStorage.getItem(buildReloadKey), null);
    });

    it(`cancels a scheduled ${responseType} handoff when the navigation is superseded`, async () => {
      using time = new FakeTime();
      const controller = new AbortController();
      setClientBuildId("build-a");
      const response = responseType === "build"
        ? new Response("ok", { headers: { "X-Juniper-Build": "build-b" } })
        : Response.json({
          location: responseType === "reload"
            ? "http://localhost/current"
            : "/replacement",
          reloadDocument: responseType === "redirect",
        }, { headers: { "X-Juniper": "redirect" } });
      using _fetch = stub(globalThis, "fetch", () => Promise.resolve(response));
      void requestData(controller.signal);
      await time.runMicrotasks();
      controller.abort();
      await time.tickAsync(1);
      assertEquals(assigned, []);
    });
  }

  it("does not follow a redirect when navigation aborts while its body is read", async () => {
    const controller = new AbortController();
    const body = Promise.withResolvers<unknown>();
    const response = new Response(null, {
      headers: { "X-Juniper": "redirect" },
    });
    using _json = stub(response, "json", () => body.promise);
    using _fetch = stub(globalThis, "fetch", () => Promise.resolve(response));
    const result = requestData(controller.signal).then(
      () => "resolved",
      () => "rejected",
    );
    await delay(0);
    controller.abort();
    body.resolve({ location: "/replacement", reloadDocument: true });
    await delay(10);
    assertEquals(assigned, []);
    assertEquals(await deadline(result, 250), "rejected");
  });
});
