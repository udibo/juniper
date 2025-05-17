/**
 * This module contains utilities for working with environment variables.
 *
 * The application environment is determined by the `APP_ENV` environment variable.
 * The default app environment is `development`. The other possible values are `test` and `production`.
 *
 * @module utils/env
 */

/**
 * Determines if the application is running in development mode.
 *
 * @returns `true` if the application is running in development mode, `false` otherwise.
 */
export function isDevelopment(): boolean {
  const appEnv = Deno.env.get("APP_ENV");
  return !appEnv || appEnv === "development";
}

/**
 * Determines if the application is running in production mode.
 *
 * @returns `true` if the application is running in production mode, `false` otherwise.
 */
export function isProduction(): boolean {
  return Deno.env.get("APP_ENV") === "production";
}

/**
 * Determines if the application is running in test mode.
 *
 * @returns `true` if the application is running in test mode, `false` otherwise.
 */
export function isTest(): boolean {
  return Deno.env.get("APP_ENV") === "test";
}
