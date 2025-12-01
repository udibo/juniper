/**
 * This module contains utilities for working with environment variables.
 *
 * The application environment is determined by the `APP_ENV` environment variable.
 * The default app environment is `development`. The other possible values are `test` and `production`.
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
 * // routes/main.ts
 * export const publicEnvKeys = ["MY_PUBLIC_API_URL", "FEATURE_FLAGS"];
 * ```
 *
 * @param key - The name of the environment variable.
 * @returns The value of the environment variable, or `undefined` if not set.
 */
export function getEnv(key: string): string | undefined {
  return env.getEnv(key);
}

/**
 * Determines if the application is running in development mode.
 *
 * @returns `true` if the application is running in development mode, `false` otherwise.
 */
export function isDevelopment(): boolean {
  const appEnv = getEnv("APP_ENV");
  return !appEnv || appEnv === "development";
}

/**
 * Determines if the application is running in production mode.
 *
 * @returns `true` if the application is running in production mode, `false` otherwise.
 */
export function isProduction(): boolean {
  return getEnv("APP_ENV") === "production";
}

/**
 * Determines if the application is running in test mode.
 *
 * @returns `true` if the application is running in test mode, `false` otherwise.
 */
export function isTest(): boolean {
  return getEnv("APP_ENV") === "test";
}

/**
 * Determines if the application is running in a server environment.
 *
 * @returns `true` if the application is running in a server environment, `false` otherwise.
 */
export function isServer(): boolean {
  return env.isServer();
}

/**
 * Determines if the application is running in a browser environment.
 *
 * @returns `true` if the application is running in a browser environment, `false` otherwise.
 */
export function isBrowser(): boolean {
  return !isServer();
}
