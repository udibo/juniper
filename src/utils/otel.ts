/**
 * This module contains utilities for OpenTelemetry integration and observability.
 *
 * @module utils/otel
 */

import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Context, Span, SpanOptions, Tracer } from "@opentelemetry/api";
import { HttpError } from "@udibo/juniper";

import { getEnv } from "@udibo/juniper/utils/env";

/**
 * Gets the current OpenTelemetry instance for error tracking and observability.
 *
 * This function retrieves the active span and returns a formatted string containing
 * the trace ID and span ID, which can be used for correlating errors with traces.
 *
 * @returns A formatted string with trace and span IDs, or undefined if no active span
 *
 * @example Using getInstance for error correlation
 * ```ts
 * import { getInstance } from "@udibo/juniper/utils/otel";
 * import { HttpError } from "@udibo/juniper";
 *
 * app.get("/api/users/:id", async (c) => {
 *   try {
 *     const user = await getUserById(c.req.param("id"));
 *     return c.json(user);
 *   } catch (cause) {
 *     const error = HttpError.from(cause);
 *     error.instance = getInstance(); // Add trace correlation
 *     throw error;
 *   }
 * });
 * ```
 */
export function getInstance(): string | undefined {
  const span = trace.getActiveSpan();
  if (span) {
    const { traceId, spanId } = span.spanContext();
    return `/trace/${traceId}/span/${spanId}`;
  }
}

/**
 * Utility interface for OpenTelemetry span operations.
 *
 * Provides a convenient wrapper around OpenTelemetry's startActiveSpan functionality
 * with automatic error handling and span lifecycle management.
 */
export interface OtelUtils {
  /**
   * Starts an active span and executes a function within its context.
   *
   * This method provides multiple overloads for different use cases:
   * - Simple span with just a name and function
   * - Span with options and function
   * - Span with options, context, and function
   */
  startActiveSpan: {
    <F extends (span: Span) => ReturnType<F>>(
      name: string,
      fn: F,
    ): ReturnType<F>;
    <F extends (span: Span) => ReturnType<F>>(
      name: string,
      opts: SpanOptions,
      fn: F,
    ): ReturnType<F>;
    <F extends (span: Span) => ReturnType<F>>(
      name: string,
      opts: SpanOptions,
      ctx: Context,
      fn: F,
    ): ReturnType<F>;
  };
}

/**
 * Creates OpenTelemetry utilities for tracing operations.
 *
 * This function provides a convenient wrapper around OpenTelemetry's tracing functionality
 * with automatic error handling, span lifecycle management, and HttpError integration.
 *
 * @param tracer - Optional OpenTelemetry tracer instance. If not provided, creates one using the APP_NAME environment variable.
 * @returns An object containing utility functions for tracing operations
 *
 * @example Using otelUtils with default tracer
 * ```ts
 * import { otelUtils } from "@udibo/juniper/utils/otel";
 *
 * const { startActiveSpan } = otelUtils();
 *
 * app.get("/api/users", async (c) => {
 *   return startActiveSpan("get-users", async (span) => {
 *     span.setAttributes({ "user.count": 10 });
 *     const users = await getUsersFromDatabase();
 *     return c.json(users);
 *   });
 * });
 * ```
 *
 * @example Using with a custom tracer
 * ```ts
 * import { trace } from "@opentelemetry/api";
 * import { otelUtils } from "@udibo/juniper/utils/otel";
 *
 * const tracer = trace.getTracer("my-service");
 * const { startActiveSpan } = otelUtils(tracer);
 * ```
 *
 * @example Using with span options
 * ```ts
 * const result = startActiveSpan(
 *   "database-query",
 *   { attributes: { "db.operation": "select" } },
 *   async (span) => {
 *     return await queryDatabase();
 *   }
 * );
 * ```
 */
export function otelUtils(tracer?: Tracer): OtelUtils {
  const t = tracer ?? trace.getTracer(getEnv("APP_NAME") ?? "unknown");
  function startActiveSpan<F extends (span: Span) => ReturnType<F>>(
    name: string,
    fn: F,
  ): ReturnType<F>;
  function startActiveSpan<F extends (span: Span) => ReturnType<F>>(
    name: string,
    opts: SpanOptions,
    fn: F,
  ): ReturnType<F>;
  function startActiveSpan<F extends (span: Span) => ReturnType<F>>(
    name: string,
    opts: SpanOptions,
    ctx: Context,
    fn: F,
  ): ReturnType<F>;
  function startActiveSpan<F extends (span: Span) => ReturnType<F>>(
    name: string,
    arg2: SpanOptions | F,
    arg3?: Context | F,
    arg4?: F,
  ): ReturnType<F> {
    const opts = typeof arg2 === "function" ? undefined : arg2;
    const ctx = typeof arg3 === "function" ? undefined : arg3;
    const fn = typeof arg2 === "function"
      ? arg2
      : typeof arg3 === "function"
      ? arg3
      : arg4 as F;
    const fnWrapped = (span: Span) => {
      function handleCause(cause: unknown): unknown {
        const error = cause instanceof Error ? cause : String(cause);
        if (error instanceof HttpError && !error.instance) {
          error.instance = getInstance();
        }
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : error,
        });
        return cause;
      }
      let isPromise = false;
      try {
        const result = fn(span);
        if (result instanceof Promise) {
          isPromise = true;
          return result
            .catch((cause) => {
              throw handleCause(cause);
            })
            .finally(() => {
              span.end();
            }) as ReturnType<F>;
        }
        return result;
      } catch (cause) {
        throw handleCause(cause);
      } finally {
        if (!isPromise) span.end();
      }
    };
    return opts
      ? ctx
        ? t.startActiveSpan(name, opts, ctx, fnWrapped)
        : t.startActiveSpan(name, opts, fnWrapped)
      : t.startActiveSpan(name, fnWrapped);
  }
  return {
    startActiveSpan,
  };
}
