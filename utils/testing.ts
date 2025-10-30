/**
 * This module contains utilities for testing Juniper applications.
 *
 * @module utils/testing
 */

import type { ClientGlobals, HydrationData } from "../_client.tsx";
import { serializeHydrationData } from "../_server.tsx";
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

/**
 * A simulated environment that restores the environment variables when disposed.
 */
export interface SimulatedEnvironment extends Disposable {
  /**
   * Restores the environment variables to their original values.
   * It will delete the environment variables that were not present in the original environment.
   * This method can only be called once.
   */
  restore: () => void;
}

/**
 * Simulates the environment variables until the simulated environment is restored or disposed.
 * The initial environment variables are the ones that were present in the current process.
 * They are overridden by the environment variables passed to the `simulateEnvironment` function.
 * If an environment variable is set to `null`, it will be deleted from the environment.
 * Simulated environments can be created within other simulated environments.
 *
 * @example Manually restoring the environment variables
 * ```ts
 * import { simulateEnvironment } from "@udibo/juniper/utils/testing";
 * import { assertEquals } from "@std/assert";
 *
 * // Set environment variables
 * Deno.env.set("FOO", "bar");
 * Deno.env.set("BAZ", "qux");
 *
 * // The real environment variables
 * assertEquals(Deno.env.get("FOO"), "bar");
 * assertEquals(Deno.env.get("BAZ"), "qux");
 * assertEquals(Deno.env.get("QUUX"), undefined);
 * assertEquals(Deno.env.get("ABCD"), undefined);
 *
 * const env = simulateEnvironment({
 *   "FOO": "foo",
 *   "BAZ": null,
 *   "QUUX": "quux",
 * });
 *
 * // The environment variables are simulated
 * assertEquals(Deno.env.get("FOO"), "foo");
 * assertEquals(Deno.env.get("BAZ"), undefined);
 * assertEquals(Deno.env.get("QUUX"), "quux");
 * assertEquals(Deno.env.get("ABCD"), undefined);
 *
 * // Set variable in the simulated environment
 * Deno.env.set("ABCD", "abcd");
 * assertEquals(Deno.env.get("ABCD"), "abcd");
 *
 * // Restore the environment variables
 * env.restore();
 *
 * // The environment variables are restored
 * assertEquals(Deno.env.get("FOO"), "bar");
 * assertEquals(Deno.env.get("BAZ"), "qux");
 * assertEquals(Deno.env.get("QUUX"), undefined);
 * assertEquals(Deno.env.get("ABCD"), undefined);
 * ```
 *
 * @example Automatically restoring the environment variables
 * ```ts
 * import { simulateEnvironment } from "@udibo/juniper/utils/testing";
 * import { assertEquals } from "@std/assert";
 *
 * // Set environment variables
 * Deno.env.set("FOO", "bar");
 * Deno.env.set("BAZ", "qux");
 *
 * // The real environment variables
 * assertEquals(Deno.env.get("FOO"), "bar");
 * assertEquals(Deno.env.get("BAZ"), "qux");
 * assertEquals(Deno.env.get("QUUX"), undefined);
 *
 * {
 *   using _env = simulateEnvironment({
 *     "FOO": "foo",
 *     "BAZ": null,
 *     "QUUX": "quux",
 *   });
 *
 *   // The environment variables are simulated
 *   assertEquals(Deno.env.get("FOO"), "foo");
 *   assertEquals(Deno.env.get("BAZ"), undefined);
 *   assertEquals(Deno.env.get("QUUX"), "quux");
 *
 *   // Set variable in the simulated environment
 *   Deno.env.set("ABCD", "abcd");
 *   assertEquals(Deno.env.get("ABCD"), "abcd");
 * }
 *
 * // The environment variables are restored
 * assertEquals(Deno.env.get("FOO"), "bar");
 * assertEquals(Deno.env.get("BAZ"), "qux");
 * assertEquals(Deno.env.get("QUUX"), undefined);
 * assertEquals(Deno.env.get("ABCD"), undefined);
 * ```
 *
 * @param environment The initial environment variables for the simulated environment.
 * @returns A simulated environment that restores the environment variables when disposed.
 */
export function simulateEnvironment(
  environment: Record<string, string | null> = {},
): SimulatedEnvironment {
  const originalEnvironment = Deno.env.toObject();
  for (const [key, value] of Object.entries(environment)) {
    if (value === null) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, value);
    }
  }

  let restored = false;
  function restore() {
    if (restored) throw new Error("Environment already restored");
    restored = true;
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

  return {
    restore,
    [Symbol.dispose]: () => {
      restore();
    },
  };
}

/**
 * A simulated browser environment that restores the globals when disposed.
 */
export interface SimulatedBrowser extends Disposable {
  /** Restores the globals to their original values. */
  restore: () => void;
}

/**
 * Simulates the globals until the simulated browser is restored or disposed.
 * The initial globals are the ones that were present in the current process.
 * They are overridden by the hydration data passed to the `simulateBrowser` function.
 *
 * In addition to the globals, the environment functions for determining if the application
 * is running in a server or browser environment are overridden.
 *
 * @param hydrationData The hydration data for the simulated browser.
 * @param options Optional configuration for serialization.
 * @returns A promise that resolves to a simulated browser that restores the globals when disposed.
 */
export async function simulateBrowser(
  hydrationData: HydrationData,
  options: {
    serializeError?: (error: unknown) => unknown;
  } = {},
): Promise<SimulatedBrowser> {
  const serializedHydrationData = await serializeHydrationData(
    hydrationData,
    options,
  );

  const originalJuniperHydrationData =
    (globalThis as ClientGlobals).__juniperHydrationData;
  (globalThis as ClientGlobals).__juniperHydrationData =
    serializedHydrationData;

  const originalIsServer = env.isServer;
  env.isServer = () => false;

  let restored = false;
  function restore() {
    if (restored) throw new Error("Browser already restored");
    restored = true;
    if (originalJuniperHydrationData) {
      (globalThis as ClientGlobals).__juniperHydrationData =
        originalJuniperHydrationData;
    } else {
      delete (globalThis as ClientGlobals).__juniperHydrationData;
    }

    env.isServer = originalIsServer;
  }

  return {
    restore,
    [Symbol.dispose]: () => {
      restore();
    },
  };
}
