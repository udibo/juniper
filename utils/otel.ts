import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Context, Span, SpanOptions, Tracer } from "@opentelemetry/api";
import { HttpError } from "@udibo/http-error";

export function getInstance(): string | undefined {
  const span = trace.getActiveSpan();
  if (span) {
    const { traceId, spanId } = span.spanContext();
    return `/trace/${traceId}/span/${spanId}`;
  }
}

export interface OtelUtils {
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
