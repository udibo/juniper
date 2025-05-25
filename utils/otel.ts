/**
 * This module contains utilities for OpenTelemetry integration and observability.
 *
 * @module utils/otel
 */

import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Context, Span, SpanOptions, Tracer } from "@opentelemetry/api";
import { HttpError } from "@udibo/http-error";

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
 * import { HttpError } from "@udibo/http-error";
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
 * Creates OpenTelemetry utilities for the given tracer.
 *
 * This function provides a convenient wrapper around OpenTelemetry's tracing functionality
 * with automatic error handling, span lifecycle management, and HttpError integration.
 *
 * @param tracer - The OpenTelemetry tracer instance
 * @returns An object containing utility functions for tracing operations
 *
 * @example Using otelUtils for tracing
 * ```ts
 * import { trace } from "@opentelemetry/api";
 * import { otelUtils } from "@udibo/juniper/utils/otel";
 *
 * const tracer = trace.getTracer("my-service");
 * const { startActiveSpan } = otelUtils(tracer);
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
export function otelUtils(tracer: Tracer): OtelUtils {
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
      function handleCause(cause: unknown): HttpError {
        const error = HttpError.from(cause);
        if (!error.instance) error.instance = getInstance();
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        return error;
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
        const error = handleCause(cause);
        throw error;
      } finally {
        if (!isPromise) span.end();
      }
    };
    return opts
      ? ctx
        ? tracer.startActiveSpan(name, opts, ctx, fnWrapped)
        : tracer.startActiveSpan(name, opts, fnWrapped)
      : tracer.startActiveSpan(name, fnWrapped);
  }
  return {
    startActiveSpan,
  };
}
