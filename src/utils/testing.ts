/**
 * This module contains utilities for testing Juniper applications.
 *
 * @module utils/testing
 */

import { AsyncLocalStorage } from "node:async_hooks";

import React from "react";
import {
  createMemoryRouter,
  RouterContextProvider,
  RouterProvider,
} from "react-router";
import type { HydrationState, RouteObject } from "react-router";
import { stub } from "@std/testing/mock";
import type { Stub } from "@std/testing/mock";
import type { FakeTime } from "@std/testing/time";
import type { waitFor as WaitForType } from "@testing-library/react";

import type { AnyParams, RouteModule } from "../mod.ts";

import { createRoute, JuniperContextProvider } from "../_client.tsx";
import type { ServerFlags } from "../_client.tsx";
import { env } from "./_env.ts";

export type { ServerFlags };

interface EnvironmentStore {
  overrides: Record<string, string | null>;
}

const environmentStorage = new AsyncLocalStorage<EnvironmentStore>();

const originalGetEnv = env.getEnv;

function patchedGetEnv(key: string): string | undefined {
  if (env.isServer()) {
    const store = environmentStorage.getStore();
    if (store !== undefined) {
      if (Object.hasOwn(store.overrides, key)) {
        const value = store.overrides[key];
        return value === null ? undefined : value;
      }
    }
  }
  return originalGetEnv(key);
}

/**
 * Whether the task arguments request snapshot updates (`--update` or `-u`).
 *
 * This only detects the flag; callers own reading and writing their snapshots.
 *
 * @returns Whether custom snapshots should be replaced.
 * @example
 * ```ts
 * import { isSnapshotMode } from "@udibo/juniper/utils/testing";
 * import { assertEquals } from "@std/assert";
 * export async function checkSnapshot(file: URL, actual: string): Promise<void> {
 *   if (isSnapshotMode()) await Deno.writeTextFile(file, actual);
 *   else assertEquals(actual, await Deno.readTextFile(file));
 * }
 * ```
 */
export function isSnapshotMode(): boolean {
  return Deno.args.some((arg) => arg === "--update" || arg === "-u");
}

/**
 * Returns a callback that runs with scoped overrides for Juniper's `getEnv`.
 *
 * It does not execute the callback immediately or mutate `Deno.env`. Overrides
 * follow asynchronous work and can be nested without leaking into sibling tests.
 * A `null` value makes `getEnv` return `undefined`; direct `Deno.env.get` calls
 * and subprocess environments are unaffected. Use this with Juniper's server
 * environment reader, not browser hydration data.
 *
 * @example Using with a test case
 * ```ts
 * import { simulateEnvironment } from "@udibo/juniper/utils/testing";
 * import { getEnv } from "@udibo/juniper/utils/env";
 * import { assertEquals } from "@std/assert";
 * import { describe, it } from "@std/testing/bdd";
 *
 * describe("Environment tests", () => {
 *   it("should use simulated environment", simulateEnvironment({
 *     "APP_ENV": "production",
 *     "DEBUG": null,
 *   }, () => {
 *     assertEquals(getEnv("APP_ENV"), "production");
 *     assertEquals(getEnv("DEBUG"), undefined);
 *   }));
 *
 *   it("should support async callbacks", simulateEnvironment({
 *     "APP_ENV": "test",
 *   }, async () => {
 *     assertEquals(getEnv("APP_ENV"), "test");
 *     await Promise.resolve();
 *   }));
 * });
 * ```
 *
 * @param environment The environment variables to set for the duration of the callback.
 * @param callback The function to execute with the simulated environment.
 * @returns A function that executes the callback with the simulated environment.
 */
export function simulateEnvironment<T extends void | Promise<void>>(
  environment: Record<string, string | null>,
  callback: () => T,
): () => T {
  return (() => {
    const parentStore = environmentStorage.getStore();
    const parentOverrides = parentStore?.overrides ?? {};
    const mergedOverrides: Record<string, string | null> = {
      ...parentOverrides,
    };
    for (const [key, value] of Object.entries(environment)) {
      mergedOverrides[key] = value;
    }

    const store: EnvironmentStore = { overrides: mergedOverrides };

    if (env.getEnv !== patchedGetEnv) {
      env.getEnv = patchedGetEnv;
    }

    return environmentStorage.run(store, () => callback());
  });
}

/**
 * A route definition for {@linkcode createRoutesStub}.
 *
 * Extends {@linkcode RouteModule} with the routing metadata the stub needs to
 * place the route in the test router.
 */
export interface RouteStub extends RouteModule<AnyParams, unknown, unknown> {
  /** The route's URL path segment. */
  path?: string;
  /** Flags marking which server-side handlers the route simulates. */
  serverFlags?: ServerFlags;
  /** Server data-request id sent in X-Juniper-Route-Id; does not set the memory router's id. */
  routeId?: string;
}

/**
 * Props for the component returned by {@linkcode createRoutesStub}.
 */
export interface RoutesStubProps {
  /** The initial history entries (URLs) the stubbed router starts at. */
  initialEntries?: string[];
  /** Initial route data, keyed by the memory router's generated ids ("0", "1", …). */
  hydrationData?: HydrationState;
}

/**
 * Options for {@linkcode createRoutesStub}.
 */
export interface CreateRoutesStubOptions {
  /**
   * A function to set up initial context values before rendering.
   * The context parameter is the RouterContextProvider that will be used for the routes.
   * Use this to set up context values that routes depend on (e.g., QueryClient for TanStack Query loaders).
   *
   * @example
   * ```ts
   * import { createContext } from "react-router";
   * import { createRoutesStub } from "@udibo/juniper/utils/testing";
   * const locale = createContext("en");
   * const Stub = createRoutesStub([{ path: "/" }], {
   *   getContext(context) { context.set(locale, "fr"); },
   * });
   * ```
   */
  getContext?: (context: RouterContextProvider) => void;
}

/**
 * Creates a memory-router component from Juniper route modules.
 *
 * Components receive Juniper props and loader/action results pass through the
 * production client adapter. Stub a loader or action to test rendering in isolation;
 * use `serverFlags`, `routeId`, and a controlled fetch to exercise a server bridge.
 * This does not execute Hono or route middleware. Seed context with `getContext`.
 *
 * Each call creates sibling routes, not a nested route tree. `hydrationData` uses
 * React Router's generated ids (`"0"`, `"1"`, …), not the server `routeId` values.
 * Create the stub outside your component's render and unmount it with `cleanup`.
 *
 * @param routes - Route modules with optional path and server-request metadata.
 * @param options - Initial context setup.
 * @returns A component; initial history defaults to the first route's path.
 * @example
 * ```tsx
 * import "@udibo/juniper/utils/global-jsdom";
 * import { afterEach, it } from "@std/testing/bdd";
 * import { cleanup, render, screen } from "@testing-library/react";
 * import { userEvent } from "@testing-library/user-event";
 * import { Form } from "react-router";
 * import type { AnyParams, RouteProps } from "@udibo/juniper";
 * import { createRoutesStub } from "@udibo/juniper/utils/testing";
 *
 * afterEach(cleanup);
 * it("renders the submitted result", async () => {
 *   const Stub = createRoutesStub([{
 *     path: "/",
 *     action: async ({ request }) => ({ name: (await request.formData()).get("name") }),
 *     default: ({ actionData }: RouteProps<AnyParams, unknown, { name: string } | undefined>) =>
 *       <Form method="post">
 *         <label>Name<input name="name" defaultValue="Ada" /></label>
 *         <button type="submit">Save</button>
 *         {actionData && <p>Saved {actionData.name}</p>}
 *       </Form>,
 *   }]);
 *   render(<Stub />);
 *   await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
 *   await screen.findByText("Saved Ada");
 * });
 * ```
 */
export function createRoutesStub(
  routes: RouteStub[],
  options?: CreateRoutesStubOptions,
): React.ComponentType<RoutesStubProps> {
  const firstPath = routes[0]?.path ?? "/";
  const routeObjects: RouteObject[] = routes.map((routeStub) => {
    const { path = "/", serverFlags, routeId, ...routeModule } = routeStub;
    const route = createRoute(routeModule, serverFlags, routeId);

    return {
      path,
      Component: route.Component,
      ErrorBoundary: route.ErrorBoundary,
      HydrateFallback: route.HydrateFallback,
      loader: route.loader,
      action: route.action,
    };
  });

  return function RoutesStub(
    { initialEntries, hydrationData }: RoutesStubProps,
  ) {
    const contextRef = React.useRef<RouterContextProvider>(null!);
    const routerRef = React.useRef<ReturnType<typeof createMemoryRouter>>(
      null!,
    );
    if (routerRef.current == null) {
      const ctx = new RouterContextProvider();
      options?.getContext?.(ctx);
      contextRef.current = ctx;
      routerRef.current = createMemoryRouter(routeObjects, {
        initialEntries: initialEntries ?? [firstPath],
        hydrationData,
        getContext: () => ctx,
      });
    }

    return React.createElement(
      JuniperContextProvider,
      {
        context: contextRef.current!,
        children: React.createElement(RouterProvider, {
          router: routerRef.current,
        }),
      },
    );
  };
}

/**
 * A fake fetch function that returns controlled responses.
 */
export type FakeFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Response | Promise<Response>;

/**
 * Replaces global `fetch` with controlled responses for a test.
 *
 * A supplied `Response` is cloned for every call. A function receives the actual
 * input and init and must return a fresh usable response. Inspect `calls` for
 * request assertions and dispose the stub with `using`. This changes a global:
 * do not overlap independent fetch stubs in the same test worker.
 *
 * @param response - Reusable response template or request-dependent handler.
 * @returns A standard testing stub with call history and automatic restoration.
 * @example
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { it } from "@std/testing/bdd";
 * import { stubFetch } from "@udibo/juniper/utils/testing";
 * it("receives a response", async () => {
 *   using fetchStub = stubFetch(Response.json({ name: "Ada" }));
 *   assertEquals(await (await fetch("https://example.test/user")).json(), { name: "Ada" });
 *   assertEquals(fetchStub.calls.length, 1);
 * });
 * ```
 */
export function stubFetch(
  response: Response | FakeFetch,
): Stub<
  typeof globalThis,
  [input: URL | RequestInfo, init?: RequestInit | undefined],
  Promise<Response>
> {
  return stub(
    globalThis,
    "fetch",
    typeof response === "function"
      ? (input: string | URL | Request, init?: RequestInit) =>
        Promise.resolve(response(input, init))
      : () => Promise.resolve(response.clone()),
  );
}

/**
 * A function that resolves a pending fetch request with the given response.
 */
export type ResolveFetch = (response: Response) => void;

/**
 * Controls one outstanding fake fetch for a pending-state test.
 *
 * Call `fakeFetch` (normally through `stubFetch`) before `resolveFetch`. Resolving
 * before a request exists does nothing. A second overlapping request replaces the
 * resolver for the first, so create separate pairs for independent requests.
 * It does not emulate aborts or network errors; use a custom fake for those cases.
 *
 * @returns `[resolveFetch, fakeFetch]`; each resolver completes its current request once.
 * @example
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { it } from "@std/testing/bdd";
 * import { fetchResolver, stubFetch } from "@udibo/juniper/utils/testing";
 * it("waits for a controlled response", async () => {
 *   const [resolve, fake] = fetchResolver();
 *   using fetchStub = stubFetch(fake);
 *   const pending = fetch("https://example.test/data");
 *   assertEquals(fetchStub.calls.length, 1);
 *   resolve(Response.json({ ready: true }));
 *   assertEquals(await (await pending).json(), { ready: true });
 * });
 * ```
 */
export function fetchResolver(): [ResolveFetch, FakeFetch] {
  let resolve: ResolveFetch | null = null;

  const fakeFetch: FakeFetch = () =>
    new Promise<Response>((res) => {
      resolve = res;
    });

  const resolveFetch: ResolveFetch = (response: Response) => {
    if (resolve) {
      resolve(response);
      resolve = null;
    }
  };

  return [resolveFetch, fakeFetch];
}

type FormControl =
  | HTMLInputElement
  | HTMLButtonElement
  | HTMLTextAreaElement
  | HTMLSelectElement;

function isSubmitButton(element: HTMLElement): boolean {
  return element.localName === "button" &&
      (element as HTMLButtonElement).type === "submit" ||
    element.localName === "input" &&
      ["submit", "image"].includes((element as HTMLInputElement).type);
}

class MockFormData extends FormData {
  constructor(form?: HTMLFormElement, submitter: HTMLElement | null = null) {
    super();
    if (form === undefined) return;
    if (!form || form.localName !== "form") {
      throw new TypeError("Expected an HTMLFormElement");
    }
    if (submitter !== null) {
      if (!isSubmitButton(submitter)) {
        throw new TypeError("The specified element is not a submit button");
      }
      if ((submitter as HTMLButtonElement | HTMLInputElement).form !== form) {
        throw new DOMException(
          "The submitter does not belong to this form",
          "NotFoundError",
        );
      }
    }

    const root = form.getRootNode() as ParentNode;
    const controls = root.querySelectorAll<FormControl>(
      "button, input, textarea, select",
    );
    for (const control of controls) {
      if (
        control.form !== form || control.matches(":disabled") ||
        control.closest("datalist")
      ) continue;
      if (
        ["submit", "image", "reset", "button"].includes(control.type) &&
        control !== submitter
      ) continue;
      if (
        ["checkbox", "radio"].includes(control.type) &&
        !(control as HTMLInputElement).checked
      ) continue;

      const name = control.name;
      if (control.localName === "input" && control.type === "image") {
        const prefix = name ? `${name}.` : "";
        this.append(`${prefix}x`, "0");
        this.append(`${prefix}y`, "0");
        continue;
      }
      if (!name) continue;
      if (control.localName === "select") {
        for (const option of (control as HTMLSelectElement).selectedOptions) {
          if (!option.disabled && !option.closest("optgroup[disabled]")) {
            this.append(name, option.value);
          }
        }
      } else if (control.localName === "input" && control.type === "file") {
        const files = (control as HTMLInputElement).files;
        if (files?.length) {
          for (const file of files) {
            if (!(file instanceof Blob)) {
              throw new TypeError(
                "Upload files created with the global File constructor, not window.File",
              );
            }
            this.append(name, file, file.name);
          }
        } else {
          this.append(
            name,
            new File([], "", { type: "application/octet-stream" }),
          );
        }
      } else {
        this.append(name, control.value);
      }
    }
  }
}

/**
 * A stub for the global `FormData` constructor that implements `Disposable`.
 */
export interface FormDataStub extends Disposable {
  /** Restores the original `FormData` constructor. */
  restore(): void;
}

/**
 * Makes Deno's global `FormData` accept JSDOM form elements and submitters.
 *
 * It collects successful controls, including controls associated by `form`, and
 * preserves multipart compatibility. Construct uploaded files with global `File`,
 * not `window.File`. Image submitters use coordinates `(0, 0)`.
 *
 * Juniper's `utils/global-jsdom` already installs this adapter. Call it yourself
 * only when setting up a custom JSDOM instance, then dispose it before that instance.
 *
 * @returns A disposable handle that restores the previous constructor.
 * @example
 * ```ts
 * import globalJsdom from "global-jsdom";
 * import { assertEquals } from "@std/assert";
 * import { stubFormData } from "@udibo/juniper/utils/testing";
 * const cleanup = globalJsdom('<form><input name="name" value="Ada"></form>', {
 *   url: "https://example.test/",
 * });
 * try {
 *   using formDataStub = stubFormData();
 *   const form = document.querySelector("form")!;
 *   assertEquals(new FormData(form).get("name"), "Ada");
 * } finally { cleanup(); }
 * ```
 */
export function stubFormData(): FormDataStub {
  const OriginalFormData = globalThis.FormData;
  globalThis.FormData = MockFormData as typeof FormData;
  const restore = () => {
    globalThis.FormData = OriginalFormData;
  };
  return {
    restore,
    [Symbol.dispose]: restore,
  };
}

/**
 * Retries a DOM assertion while a standard `FakeTime` clock is installed.
 *
 * Testing Library's normal `waitFor` can hang while its cleanup timers are frozen.
 * This helper drains timers due at the current fake time; it does not advance time
 * for you. Call `time.tick` for application delays. The normal waitFor timeout still
 * applies, and rejection contains the last assertion failure.
 *
 * @param time - The active fake clock.
 * @param callback - Assertion retried until it stops throwing.
 * @param options - Testing Library wait options, including timeout and interval.
 * @returns The successful callback result.
 * @example
 * ```tsx
 * import "@udibo/juniper/utils/global-jsdom";
 * import { afterEach, it } from "@std/testing/bdd";
 * import { FakeTime } from "@std/testing/time";
 * import { cleanup, render, screen } from "@testing-library/react";
 * import { waitForFakeTime } from "@udibo/juniper/utils/testing";
 * afterEach(cleanup);
 * it("renders a deterministic date", async () => {
 *   using time = new FakeTime("2026-01-01T00:00:00Z");
 *   render(<p>{new Date().toISOString()}</p>);
 *   await waitForFakeTime(time, () => screen.getByText("2026-01-01T00:00:00.000Z"));
 * });
 * ```
 */
export async function waitForFakeTime<T>(
  time: FakeTime,
  callback: () => T,
  options?: Parameters<typeof WaitForType>[1],
): Promise<T> {
  const { FakeTime: FT } = await import("@std/testing/time");
  const { waitFor } = await import("@testing-library/react");
  const promise = waitFor(callback, options);
  const id = await FT.restoreFor(() => setInterval(() => time.tick(0), 10));
  try {
    return await promise;
  } finally {
    await FT.restoreFor(() => clearInterval(id));
  }
}
