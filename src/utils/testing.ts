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
 * Determines if the current process is running in snapshot mode.
 * This is useful for determining if tests that use snapshot assertion should be updating their snapshots.
 * This function makes it easy for you to choose where and how the snapshot is stored, making changes to the snapshot file easier to review.
 * Deno's `assertSnapshot` function stores the snapshots in the `__snapshots__` directory, with the snapshot stored as a string in a TypeScript file.
 *
 * @example Test with manual snapshot using `isSnapshotMode`
 * ```ts
 * import { isSnapshotMode } from "@udibo/juniper/utils/testing";
 * import { assertEquals } from "@std/assert";
 * import { resolve } from "@std/path";
 * import { describe, it } from "@std/testing/bdd";
 *
 * describe("API snapshot tests", () => {
 *   it("should match snapshot for /api/hello response", async () => {
 *     // Make request to the API endpoint
 *     const response = await fetch("http://localhost:8000/api/hello");
 *     const body = await response.text();
 *
 *     // Define snapshot file path relative to test file
 *     const snapshotPath = resolve(
 *       import.meta.dirname!,
 *       "./hello.json"
 *     );
 *
 *     if (isSnapshotMode()) {
 *       // Update snapshot file in snapshot mode
 *       await Deno.writeTextFile(snapshotPath, body);
 *       console.log(`Updated snapshot: ${snapshotPath}`);
 *     } else {
 *       // Verify response matches snapshot in normal test mode
 *       const snapshot = await Deno.readTextFile(snapshotPath);
 *       assertEquals(body, snapshot, "Response body should match snapshot");
 *     }
 *   });
 * });
 * ```
 *
 * @returns `true` if the current process is running in snapshot mode, `false` otherwise.
 */
export function isSnapshotMode(): boolean {
  return Deno.args.some((arg) => arg === "--update" || arg === "-u");
}

/**
 * Simulates environment variables for the duration of a callback.
 * The environment variables are automatically restored after the callback completes,
 * whether it returns normally, throws an error, or returns a rejected promise.
 *
 * If an environment variable is set to `null`, it will be deleted from the environment.
 * Simulated environments can be nested within other simulated environments.
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

export interface RouteStub extends RouteModule<AnyParams, unknown, unknown> {
  path?: string;
  serverFlags?: ServerFlags;
  routeId?: string;
}

export interface RoutesStubProps {
  initialEntries?: string[];
  hydrationData?: HydrationState;
}

export interface CreateRoutesStubOptions {
  /**
   * A function to set up initial context values before rendering.
   * The context parameter is the RouterContextProvider that will be used for the routes.
   * Use this to set up context values that routes depend on (e.g., QueryClient for TanStack Query loaders).
   *
   * @example Setting up a QueryClient for TanStack Query
   * ```tsx
   * const Stub = createRoutesStub([contactsRoute], {
   *   getContext(context) {
   *     context.set(queryClientContext, new QueryClient());
   *   },
   * });
   * ```
   */
  getContext?: (context: RouterContextProvider) => void;
}

/**
 * Creates a stub component for testing Juniper route modules.
 *
 * This helper uses Juniper's `createRoute` to convert route modules into
 * React Router route objects, then renders them in a memory router. This ensures
 * your tests run through the same adaptation layer as production.
 *
 * @example Testing a route with a loader
 * ```tsx
 * import "@udibo/juniper/utils/global-jsdom";
 * import { afterEach, describe, it } from "@std/testing/bdd";
 * import { cleanup, render, screen, waitFor } from "@testing-library/react";
 * import { createRoutesStub } from "@udibo/juniper/utils/testing";
 *
 * import * as loaderRoute from "./loader.tsx";
 *
 * describe("LoaderDemo route", () => {
 *   afterEach(cleanup);
 *
 *   it("should render loaded data", async () => {
 *     const Stub = createRoutesStub([loaderRoute]);
 *     render(<Stub />);
 *
 *     await waitFor(() => {
 *       screen.getByText("Data loaded successfully!");
 *     });
 *   });
 * });
 * ```
 *
 * @example Testing with a stubbed loader
 * ```tsx
 * import "@udibo/juniper/utils/global-jsdom";
 * import { afterEach, describe, it } from "@std/testing/bdd";
 * import { cleanup, render, screen, waitFor } from "@testing-library/react";
 * import { createRoutesStub } from "@udibo/juniper/utils/testing";
 *
 * import * as loaderRoute from "./loader.tsx";
 *
 * describe("LoaderDemo route", () => {
 *   afterEach(cleanup);
 *
 *   it("should render with stubbed loader data", async () => {
 *     const Stub = createRoutesStub([{
 *       ...loaderRoute,
 *       loader() {
 *         return {
 *           timestamp: "2025-01-01T00:00:00.000Z",
 *           randomNumber: 42,
 *           message: "Stubbed data!",
 *         };
 *       },
 *     }]);
 *     render(<Stub />);
 *
 *     await waitFor(() => {
 *       screen.getByText("Stubbed data!");
 *     });
 *   });
 * });
 * ```
 *
 * @example Testing with initial context (e.g., TanStack Query)
 * ```tsx
 * import "@udibo/juniper/utils/global-jsdom";
 * import { afterEach, describe, it } from "@std/testing/bdd";
 * import { cleanup, render, screen, waitFor } from "@testing-library/react";
 * import { QueryClient } from "@tanstack/react-query";
 * import { createRoutesStub } from "@udibo/juniper/utils/testing";
 *
 * import { queryClientContext } from "@/context/query.ts";
 * import * as contactsRoute from "./contacts/index.tsx";
 *
 * describe("Contacts route", () => {
 *   afterEach(cleanup);
 *
 *   it("should render with QueryClient context", async () => {
 *     const Stub = createRoutesStub([{
 *       ...contactsRoute,
 *       loader() {
 *         return [{ id: "1", firstName: "John", lastName: "Doe", email: "john@example.com" }];
 *       },
 *     }], {
 *       getContext(context) {
 *         context.set(queryClientContext, new QueryClient());
 *       },
 *     });
 *     render(<Stub />);
 *
 *     await waitFor(() => {
 *       screen.getByText("John Doe");
 *     });
 *   });
 * });
 * ```
 *
 * @param routes - Array of route modules to stub. Each can optionally include a `path`, `serverFlags`, and `routeId`.
 * @param options - Optional configuration for the stub.
 * @returns A React component that renders the stubbed routes in a memory router. The `initialEntries` prop defaults to the first route's path.
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
    const context = React.useMemo(() => {
      const ctx = new RouterContextProvider();
      options?.getContext?.(ctx);
      return ctx;
    }, []);
    const router = createMemoryRouter(routeObjects, {
      initialEntries: initialEntries ?? [firstPath],
      hydrationData,
      getContext: () => context,
    });

    return React.createElement(
      JuniperContextProvider,
      { context, children: React.createElement(RouterProvider, { router }) },
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
 * Stubs the global `fetch` function to return controlled responses.
 * Uses Deno's standard testing/mock library. The returned stub implements
 * `Disposable` for automatic cleanup with the `using` keyword.
 *
 * @example Stubbing fetch with automatic cleanup using `using`
 * ```ts
 * import { stubFetch } from "@udibo/juniper/utils/testing";
 * import { assertEquals } from "@std/assert";
 * import { describe, it } from "@std/testing/bdd";
 *
 * describe("API tests", () => {
 *   it("should handle successful response", async () => {
 *     using fetchStub = stubFetch(Response.json({ id: "123", name: "John" }));
 *
 *     const response = await fetch("/api/users/123");
 *     const data = await response.json();
 *     assertEquals(data.name, "John");
 *     assertEquals(fetchStub.calls.length, 1);
 *   });
 * });
 * ```
 *
 * @example Stubbing fetch with manual cleanup
 * ```ts
 * import { stubFetch } from "@udibo/juniper/utils/testing";
 * import { assertEquals } from "@std/assert";
 * import { describe, it } from "@std/testing/bdd";
 *
 * describe("API tests", () => {
 *   it("should handle successful response", async () => {
 *     const fetchStub = stubFetch(Response.json({ id: "123", name: "John" }));
 *
 *     try {
 *       const response = await fetch("/api/users/123");
 *       const data = await response.json();
 *       assertEquals(data.name, "John");
 *     } finally {
 *       fetchStub.restore();
 *     }
 *   });
 * });
 * ```
 *
 * @example Stubbing fetch with a dynamic response
 * ```ts
 * import { stubFetch } from "@udibo/juniper/utils/testing";
 * import { describe, it } from "@std/testing/bdd";
 *
 * describe("API tests", () => {
 *   it("should handle requests dynamically", async () => {
 *     using fetchStub = stubFetch((input) => {
 *       if (input.toString().includes("/users")) {
 *         return Response.json([{ id: "1", name: "Alice" }]);
 *       }
 *       return new Response("Not Found", { status: 404 });
 *     });
 *
 *     // Test code here
 *   });
 * });
 * ```
 *
 * @param response - A Response object to return for all requests, or a function that receives the request and returns a Response.
 * @returns A Deno `Stub` with `restore()` method, call monitoring via `calls`, and `Disposable` support.
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
 * Creates a deferred fetch resolver for testing pending/loading states.
 *
 * This utility returns a tuple of `[resolveFetch, fakeFetch]` where:
 * - `fakeFetch` is passed to `stubFetch` and will wait for resolution
 * - `resolveFetch` is called with a Response to resolve the pending fetch
 *
 * This is useful for testing loading states, where you need to verify
 * UI behavior while a request is in flight before resolving it.
 *
 * @example Testing a loading state
 * ```ts
 * import { fetchResolver, stubFetch } from "@udibo/juniper/utils/testing";
 * import { render, screen, waitFor } from "@testing-library/react";
 * import { userEvent } from "@testing-library/user-event";
 * import { describe, it } from "@std/testing/bdd";
 *
 * describe("Form tests", () => {
 *   it("should show loading state while submitting", async () => {
 *     const [resolveFetch, fakeFetch] = fetchResolver();
 *     using fetchStub = stubFetch(fakeFetch);
 *     const user = userEvent.setup();
 *
 *     render(<MyForm />);
 *     await user.click(screen.getByRole("button", { name: "Submit" }));
 *
 *     // Verify loading state is shown
 *     await waitFor(() => {
 *       screen.getByText("Loading...");
 *     });
 *
 *     // Resolve the fetch to complete the request
 *     resolveFetch(Response.json({ success: true }));
 *
 *     // Verify success state
 *     await waitFor(() => {
 *       screen.getByText("Success!");
 *     });
 *   });
 * });
 * ```
 *
 * @returns A tuple of `[resolveFetch, fakeFetch]`.
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

/**
 * A mock FormData class that works with JSDOM form elements in Deno.
 *
 * Deno's native FormData constructor doesn't accept JSDOM HTMLFormElement objects,
 * which causes "Illegal constructor" errors when testing form submissions.
 * This class provides the same interface but extracts form data manually.
 */
class MockFormData extends FormData {
  constructor(form?: HTMLFormElement) {
    super();
    if (form) {
      const inputs = form.querySelectorAll("input, textarea, select");
      inputs.forEach((input) => {
        const el = input as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement;
        if (el.name) {
          this.append(el.name, el.value);
        }
      });
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
 * Stubs the global `FormData` constructor to work with JSDOM form elements.
 * Implements `Disposable` for automatic cleanup with the `using` keyword.
 *
 * This is necessary because Deno's native FormData constructor throws
 * "Illegal constructor" when passed a JSDOM HTMLFormElement. This stub
 * replaces FormData with a compatible implementation that manually extracts
 * form field values.
 *
 * **Note:** If you are using `@udibo/juniper/utils/global-jsdom` to set up JSDOM,
 * this function is already called automatically and you do not need to call it yourself.
 * You only need to use this function directly when using `npm:global-jsdom` instead
 * (for example, if you need a URL other than localhost).
 *
 * @example Testing form submission with automatic cleanup using `using`
 * ```ts
 * import { stubFormData } from "@udibo/juniper/utils/testing";
 * import { render, screen } from "@testing-library/react";
 * import { userEvent } from "@testing-library/user-event";
 * import { describe, it } from "@std/testing/bdd";
 *
 * describe("Form tests", () => {
 *   it("should submit form data", async () => {
 *     using formDataStub = stubFormData();
 *     const user = userEvent.setup();
 *
 *     render(<MyForm />);
 *     await user.type(screen.getByLabelText("Name"), "John");
 *     await user.click(screen.getByRole("button", { name: "Submit" }));
 *     // Assert form submission behavior
 *   });
 * });
 * ```
 *
 * @example Testing form submission with manual cleanup
 * ```ts
 * import { stubFormData } from "@udibo/juniper/utils/testing";
 * import { render, screen } from "@testing-library/react";
 * import { userEvent } from "@testing-library/user-event";
 * import { describe, it } from "@std/testing/bdd";
 *
 * describe("Form tests", () => {
 *   it("should submit form data", async () => {
 *     const formDataStub = stubFormData();
 *     const user = userEvent.setup();
 *
 *     try {
 *       render(<MyForm />);
 *       await user.type(screen.getByLabelText("Name"), "John");
 *       await user.click(screen.getByRole("button", { name: "Submit" }));
 *       // Assert form submission behavior
 *     } finally {
 *       formDataStub.restore();
 *     }
 *   });
 * });
 * ```
 *
 * @returns A `FormDataStub` with `restore()` method and `Disposable` support.
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
