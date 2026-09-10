/**
 * This module contains utilities for working with environment variables.
 *
 * The application environment is determined by the `APP_ENV` environment variable.
 * An absent or empty value enables development behavior. Only the exact values
 * `production` and `test` enable those respective predicates; `NODE_ENV` does not
 * control them. Browser values are the snapshot embedded in the current document.
 *
 * @module utils/env
 */

import { env } from "./_env.ts";

/**
 * Gets the value of an environment variable.
 *
 * On the server, this function retrieves the value from `Deno.env`.
 * On the client, this function retrieves the value from the `publicEnv` object
 * that was serialized during server-side rendering.
 *
 * By default, only three environment variables are available on the client:
 * - `APP_NAME` - The name of the application
 * - `APP_ENV` - The application environment (e.g., "development", "production", "test")
 * - `NODE_ENV` - The Node.js environment
 *
 * To make additional environment variables available to the client, export a
 * `publicEnvKeys` array from your root server route (`routes/main.ts`):
 *
 * @example Making additional environment variables available to the client
 * ```ts
 * export const publicEnvKeys = ["MY_PUBLIC_API_URL", "FEATURE_FLAGS"];
 * ```
 *
 * @param key - The name of the environment variable.
 * @returns The value of the environment variable, or `undefined` if not set.
 * @throws Deno.errors.NotCapable when server environment access is not permitted.
 */
export function getEnv(key: string): string | undefined {
  return env.getEnv(key);
}

/**
 * Determines if the application is running in development mode.
 *
 * @returns `true` if the application is running in development mode, `false` otherwise.
 * @example
 * ```ts
 * import { isDevelopment } from "@udibo/juniper/utils/env";
 * const showDebugDetails = isDevelopment();
 * ```
 */
export function isDevelopment(): boolean {
  const appEnv = getEnv("APP_ENV");
  return !appEnv || appEnv === "development";
}

/**
 * Determines if the application is running in production mode.
 *
 * @returns `true` if the application is running in production mode, `false` otherwise.
 * @example
 * ```ts
 * import { isProduction } from "@udibo/juniper/utils/env";
 * const useSecureCookies = isProduction();
 * ```
 */
export function isProduction(): boolean {
  return getEnv("APP_ENV") === "production";
}

/**
 * Determines if the application is running in test mode.
 *
 * @returns `true` if the application is running in test mode, `false` otherwise.
 * @example
 * ```ts
 * import { isTest } from "@udibo/juniper/utils/env";
 * const databaseName = isTest() ? "app_test" : "app";
 * ```
 */
export function isTest(): boolean {
  return getEnv("APP_ENV") === "test";
}

/**
 * Detects a server runtime by the presence of a `Deno` or `process` global.
 * This is a runtime heuristic, not a check for the presence of DOM globals;
 * a Deno process with JSDOM still counts as a server.
 *
 * @returns `true` if the application is running in a server environment, `false` otherwise.
 * @example
 * ```ts
 * import { isServer } from "@udibo/juniper/utils/env";
 * const runtime = isServer() ? "server" : "browser";
 * ```
 */
export function isServer(): boolean {
  return env.isServer();
}

/**
 * Returns the inverse of {@linkcode isServer}. Do not use this predicate to
 * decide whether DOM APIs exist in a worker or a test environment.
 *
 * @returns `true` if the application is running in a browser environment, `false` otherwise.
 * @example
 * ```ts
 * import { isBrowser } from "@udibo/juniper/utils/env";
 * const storage = isBrowser() && typeof localStorage !== "undefined" ? localStorage : undefined;
 * ```
 */
export function isBrowser(): boolean {
  return !isServer();
}
