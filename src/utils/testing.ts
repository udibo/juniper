/**
 * This module contains utilities for testing Juniper applications.
 *
 * @module utils/testing
 */

import "global-jsdom/register";
import { AsyncLocalStorage } from "node:async_hooks";

import { env } from "./_env.ts";

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
