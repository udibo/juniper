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

import type { AnyParams, RouteModule } from "@udibo/juniper";

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

/**
 * Creates a stub component for testing Juniper route modules.
 *
 * This helper uses Juniper's `createRoute` to convert route modules into
 * React Router route objects, then renders them in a memory router. This ensures
 * your tests run through the same adaptation layer as production.
 *
 * @example Testing a route with a loader
 * ```tsx
 * import "global-jsdom/register";
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
 * import "global-jsdom/register";
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
 * @param routes - Array of route modules to stub. Each can optionally include a `path`, `serverFlags`, and `routeId`.
 * @returns A React component that renders the stubbed routes in a memory router. The `initialEntries` prop defaults to the first route's path.
 */
export function createRoutesStub(
  routes: RouteStub[],
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
    const context = React.useMemo(() => new RouterContextProvider(), []);
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
