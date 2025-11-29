/**
 * This module contains utilities for testing Juniper applications.
 *
 * @module utils/testing
 */

import type { HydrationData } from "../_client.tsx";
import {
  DEFAULT_PUBLIC_ENV_KEYS,
  serializeHydrationData,
} from "../_server.tsx";
import { env } from "./_env.ts";

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

function restoreEnvironment(originalEnvironment: Record<string, string>): void {
  const keys = new Set(Object.keys(Deno.env.toObject())).union(
    new Set(Object.keys(originalEnvironment)),
  );
  for (const key of keys) {
    const value = originalEnvironment[key] ?? null;
    if (value === null) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
}

function applyEnvironment(
  environment: Record<string, string | null>,
): Record<string, string> {
  const originalEnvironment = Deno.env.toObject();
  for (const [key, value] of Object.entries(environment)) {
    if (value === null) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }
  return originalEnvironment;
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
 * import { assertEquals } from "@std/assert";
 * import { describe, it } from "@std/testing/bdd";
 *
 * describe("Environment tests", () => {
 *   it("should use simulated environment", simulateEnvironment({
 *     "APP_ENV": "production",
 *     "DEBUG": null,
 *   }, () => {
 *     assertEquals(Deno.env.get("APP_ENV"), "production");
 *     assertEquals(Deno.env.get("DEBUG"), undefined);
 *   }));
 *
 *   it("should support async callbacks", simulateEnvironment({
 *     "APP_ENV": "test",
 *   }, async () => {
 *     assertEquals(Deno.env.get("APP_ENV"), "test");
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
    const originalEnvironment = applyEnvironment(environment);
    try {
      const result = callback();
      if (result instanceof Promise) {
        return result.finally(() => {
          restoreEnvironment(originalEnvironment);
        }) as T;
      }
      restoreEnvironment(originalEnvironment);
      return result;
    } catch (error) {
      restoreEnvironment(originalEnvironment);
      throw error;
    }
  }) as () => T;
}

export interface SimulateBrowserOptions {
  serializeError?: (error: unknown) => unknown;
  publicEnvKeys?: string[];
}

/**
 * Simulates a browser environment for the duration of a callback.
 * The browser globals are automatically restored after the callback completes,
 * whether it returns normally, throws an error, or returns a rejected promise.
 *
 * This function sets up the hydration data and overrides `env.isServer` to return `false`,
 * simulating a browser environment for testing client-side code.
 *
 * @example Using with a test case
 * ```ts
 * import { simulateBrowser } from "@udibo/juniper/utils/testing";
 * import { assertEquals } from "@std/assert";
 * import { describe, it } from "@std/testing/bdd";
 * import { isBrowser, isServer } from "@udibo/juniper/utils/env";
 *
 * describe("Browser tests", () => {
 *   it("should simulate browser environment", simulateBrowser(() => {
 *     assertEquals(isBrowser(), true);
 *     assertEquals(isServer(), false);
 *   }));
 *
 *   it("should simulate browser environment with hydration data", simulateBrowser({
 *     matches: [],
 *     publicEnv: { APP_ENV: "production" },
 *   }, () => {
 *     assertEquals(isBrowser(), true);
 *     assertEquals(isServer(), false);
 *   }));
 * });
 * ```
 *
 * @param hydrationData The hydration data for the simulated browser. Defaults to `{ matches: [] }`.
 * @param options Options for the simulated browser.
 * @param callback The function to execute with the simulated browser environment.
 * @returns A function that returns a promise which executes the callback with the simulated browser environment.
 */
export function simulateBrowser<T extends void | Promise<void>>(
  callback: () => T,
): () => Promise<void>;
export function simulateBrowser<T extends void | Promise<void>>(
  options: SimulateBrowserOptions,
  callback: () => T,
): () => Promise<void>;
export function simulateBrowser<T extends void | Promise<void>>(
  hydrationData: HydrationData,
  callback: () => T,
): () => Promise<void>;
export function simulateBrowser<T extends void | Promise<void>>(
  hydrationData: HydrationData,
  options: SimulateBrowserOptions,
  callback: () => T,
): () => Promise<void>;
export function simulateBrowser<T extends void | Promise<void>>(
  hydrationDataOrOptionsOrCallback:
    | HydrationData
    | SimulateBrowserOptions
    | (() => T),
  optionsOrCallback?: SimulateBrowserOptions | (() => T),
  maybeCallback?: () => T,
): () => Promise<void> {
  let hydrationData: HydrationData;
  let options: SimulateBrowserOptions;
  let callback: () => T;

  if (typeof hydrationDataOrOptionsOrCallback === "function") {
    hydrationData = { matches: [] };
    options = {};
    callback = hydrationDataOrOptionsOrCallback;
  } else if (typeof optionsOrCallback === "function") {
    if ("matches" in hydrationDataOrOptionsOrCallback) {
      hydrationData = hydrationDataOrOptionsOrCallback;
      options = {};
    } else {
      hydrationData = { matches: [] };
      options = hydrationDataOrOptionsOrCallback;
    }
    callback = optionsOrCallback;
  } else {
    hydrationData = hydrationDataOrOptionsOrCallback as HydrationData;
    options = optionsOrCallback as SimulateBrowserOptions;
    callback = maybeCallback!;
  }

  return async () => {
    const allPublicEnvKeys = [
      ...new Set([
        ...DEFAULT_PUBLIC_ENV_KEYS,
        ...(options.publicEnvKeys ?? []),
      ]),
    ];
    const publicEnv: Record<string, string> = {};
    for (const key of allPublicEnvKeys) {
      const value = Deno.env.get(key);
      if (value !== undefined) {
        publicEnv[key] = value;
      }
    }
    const serializedHydrationData = await serializeHydrationData(
      {
        ...hydrationData,
        publicEnv: { ...publicEnv, ...hydrationData.publicEnv },
      },
      { serializeError: options.serializeError },
    );

    const originalJuniperHydrationData = env.getHydrationData();
    env.setHydrationData(serializedHydrationData);

    const originalIsServer = env.isServer;
    env.isServer = () => false;

    try {
      const result = callback();
      if (result instanceof Promise) {
        await result;
      }
    } finally {
      env.setHydrationData(originalJuniperHydrationData);
      env.isServer = originalIsServer;
    }
  };
}
