/**
 * Middleware utilities and adapters for Juniper.
 *
 * This module provides adapters for using middleware from various React Router
 * ecosystems (Remix, React Router v6/v7, Express, etc.) with Juniper.
 *
 * @module
 */

export * from "./adapters.ts";

// Re-export commonly used types
export type {
  MiddlewareFunction,
  RouteMiddlewareArgs,
} from "../mod.ts";
