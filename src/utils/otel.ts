/**
 * This module contains utilities for OpenTelemetry integration and observability.
 *
 * @module utils/otel
 */

import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Context, Span, SpanOptions, Tracer } from "@opentelemetry/api";
import { HttpError } from "../mod.ts";

import { getEnv } from "./env.ts";

/**
 * Returns the active span's correlation path for an error's `instance` field.
 *
 * The path contains a trace id and span id; it is an identifier, not a built-in
 * Juniper endpoint. No active span means no correlation value.
 *
 * @returns `/trace/<traceId>/span/<spanId>`, or `undefined` without an active span.
 * @example
 * ```ts
 * import { HttpError } from "@udibo/juniper";
 * import { getInstance } from "@udibo/juniper/utils/otel";
 * const error = new HttpError(503, "Service unavailable");
 * error.instance = getInstance();
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
   * Starts an active span, runs `fn` inside it, and returns its result.
   *
   * The span ends when `fn` returns or its promise settles. A thrown error is
   * recorded on the span, sets the span status to `ERROR`, and is rethrown; an
   * {@linkcode HttpError} with no `instance` gets one from
   * {@linkcode getInstance}.
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
 * Creates span helpers using a supplied tracer or the application's default tracer.
 *
 * `startActiveSpan` preserves the callback's sync or Promise return type, ends the
 * span when it settles, records thrown errors, and rethrows the original failure.
 * An `HttpError` without an instance receives the active trace correlation path.
 * Configure an OpenTelemetry provider/exporter separately; this helper does not
 * install one or export telemetry by itself.
 *
 * @param tracer - Tracer to use; defaults to a tracer named by APP_NAME (or "unknown").
 * @returns A `startActiveSpan` helper with name, options, and explicit-context overloads.
 * @example
 * ```ts
 * import { otelUtils } from "@udibo/juniper/utils/otel";
 * const { startActiveSpan } = otelUtils();
 * const total = startActiveSpan("calculate-total", {
 *   attributes: { "items.count": 3 },
 * }, (span) => {
 *   const result = [10, 20, 30].reduce((sum, value) => sum + value, 0);
 *   span.setAttribute("total", result);
 *   return result;
 * });
 * console.info(total);
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
