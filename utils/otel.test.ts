import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertIsError,
  assertRejects,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { SpanStatusCode } from "@opentelemetry/api";
import type { Context, Span, SpanOptions, Tracer } from "@opentelemetry/api";
import { HttpError } from "@udibo/http-error";

import { otelUtils } from "@udibo/juniper/utils/otel";

type FakeState = {
  ended: boolean;
  recordedExceptions: unknown[];
  status: { code: SpanStatusCode; message: string | undefined };
};
type StatefulSpan = Span & { __state: FakeState };
function createFakeSpan(): StatefulSpan {
  const state: FakeState = {
    ended: false,
    recordedExceptions: [],
    status: { code: SpanStatusCode.UNSET, message: undefined },
  };
  const span = {
    end: () => {
      state.ended = true;
    },
    recordException: (e: unknown) => {
      state.recordedExceptions.push(e);
    },
    setStatus: (s: { code: SpanStatusCode; message: string | undefined }) => {
      state.status = s;
      return span as StatefulSpan;
    },
  } as unknown as StatefulSpan;
  (span as StatefulSpan).__state = state;
  return span;
}

type TracerWithCalls = Tracer & {
  __calls: Array<{ name: string; opts?: SpanOptions; ctx?: Context } | string>;
};
function createFakeTracer(): TracerWithCalls {
  const calls: Array<
    { name: string; opts?: SpanOptions; ctx?: Context } | string
  > = [];
  const tracer = {
    startSpan: (
      _name: string,
      _options?: SpanOptions,
      _context?: Context,
    ) => ({} as Span),
    startActiveSpan: (
      name: string,
      arg2: unknown,
      arg3?: unknown,
      arg4?: unknown,
    ) => {
      const span = createFakeSpan();
      if (typeof arg2 === "function") {
        calls.push(name);
        return (arg2 as (s: Span) => unknown)(span);
      }
      if (typeof arg3 === "function") {
        calls.push({ name, opts: arg2 as SpanOptions });
        return (arg3 as (s: Span) => unknown)(span);
      }
      calls.push({ name, opts: arg2 as SpanOptions, ctx: arg3 as Context });
      return (arg4 as (s: Span) => unknown)(span);
    },
    __calls: calls,
  } as TracerWithCalls;
  return tracer;
}

describe("otelUtils.startActiveSpan", () => {
  it("calls simple overload and ends span on sync success", () => {
    const tracer = createFakeTracer();
    const { startActiveSpan } = otelUtils(tracer);
    let observedSpan: StatefulSpan | undefined;
    const result = startActiveSpan("simple", (span) => {
      observedSpan = span as StatefulSpan;
      return 42;
    });
    assertEquals(result, 42);
    assert(observedSpan);
    assertEquals(observedSpan!.__state.ended, true);
    assertEquals(tracer.__calls.length, 1);
  });

  it("calls overload with options and ends span on async success", async () => {
    const tracer = createFakeTracer();
    const { startActiveSpan } = otelUtils(tracer);
    let observedSpan: StatefulSpan | undefined;
    const result = await startActiveSpan(
      "with-opts",
      { attributes: { foo: "bar" } },
      (span) => {
        observedSpan = span as StatefulSpan;
        return Promise.resolve("ok");
      },
    );
    assertEquals(result, "ok");
    assert(observedSpan);
    assertEquals(observedSpan!.__state.ended, true);
    assertEquals(tracer.__calls.length, 1);
  });

  it("calls overload with options+ctx and records exception on async error", async () => {
    const tracer = createFakeTracer();
    const { startActiveSpan } = otelUtils(tracer);
    let observedSpan: StatefulSpan | undefined;
    const error = new Error("boom");
    await assertRejects(async () => {
      await startActiveSpan(
        "with-ctx",
        {},
        {} as unknown as Context,
        (span) => {
          observedSpan = span as StatefulSpan;
          return Promise.reject(error);
        },
      );
    });
    assert(observedSpan);
    assertEquals(observedSpan!.__state.ended, true);
    assertEquals(observedSpan!.__state.recordedExceptions.length, 1);
    const recordedException = observedSpan!.__state.recordedExceptions[0];
    assertIsError(recordedException, Error, "boom");
    assertEquals(observedSpan!.__state.status.code, SpanStatusCode.ERROR);
  });

  it("records exception on sync error and ends span", () => {
    const tracer = createFakeTracer();
    const { startActiveSpan } = otelUtils(tracer);
    const err = new TypeError("nope");
    try {
      startActiveSpan("sync-error", (_span) => {
        throw err;
      });
      assert(false);
    } catch (error) {
      assertIsError(error, TypeError, "nope");
    }
  });
});
