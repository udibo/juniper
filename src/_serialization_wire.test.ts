import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { delay } from "@std/async/delay";
import { stub } from "@std/testing/mock";
import { HttpError, registerError, registerType } from "@udibo/juniper";
import {
  createLoaderDataResponse,
  createStreamingLoaderData,
  deserializeError,
  deserializeHydrationData,
  deserializeLoaderData,
  deserializeStreamingLoaderData,
  fromTaggedJson,
  resetRegistries,
  serializeError,
  serializeHydrationData,
  serializeLoaderData,
  toTaggedJson,
} from "./_serialization.ts";

class Box {
  constructor(public value: unknown) {}
}

const hostileObjects = [
  { $t: "Date", v: 0 },
  { $t: "type", v: { __type: "X", data: 1 } },
  { $t: "object", v: [["admin", true]] },
  { $t: "pending", v: "p0" },
  JSON.parse('{"__proto__":{"isAdmin":true}}'),
];

describe("one tagged JSON wire format", () => {
  beforeEach(resetRegistries);
  afterEach(resetRegistries);

  it("encodes settled data as tagged JSON text", async () => {
    const text = await serializeLoaderData({ value: 123n });
    assertEquals(typeof text, "string");
    assertEquals(JSON.parse(String(text)), {
      value: { $t: "bigint", v: "123" },
    });
  });

  it("keeps every bigint including small values", () => {
    for (const value of [0n, 123n, -(2n ** 53n), 2n ** 70n]) {
      assertEquals(fromTaggedJson(toTaggedJson(value)), value);
    }
  });

  it("keeps tag-shaped data through hydration, settled data and both stream positions", async () => {
    registerType({
      name: "Box",
      is: (v): v is Box => v instanceof Box,
      serialize: (v) => v.value,
      deserialize: (v) => new Box(v),
    });
    const data = {
      objects: hostileObjects,
      nested: [hostileObjects],
      box: new Box(hostileObjects),
    };
    const hydration = deserializeHydrationData(
      await serializeHydrationData({
        matches: [],
        loaderData: { route: data },
      }),
    );
    const settled = deserializeLoaderData(await serializeLoaderData(data));
    const streaming = await deserializeStreamingLoaderData<
      { initial: unknown; later: Promise<unknown> }
    >(
      new Response(
        createStreamingLoaderData({
          initial: data,
          later: Promise.resolve(data),
        }),
      ),
    );
    for (
      const value of [
        hydration.loaderData?.route,
        settled,
        streaming.initial,
        await streaming.later,
      ]
    ) {
      assertEquals(value, data);
    }
  });

  it("recursively restores serializer output with tag keys, own proto, Date, undefined and promises", async () => {
    registerType({
      name: "Box",
      is: (v): v is Box => v instanceof Box,
      serialize: (v) => v.value,
      deserialize: (v) => new Box(v),
    });
    const value = JSON.parse('{"$t":"Date","v":5,"__proto__":{"x":1}}');
    value.n = NaN;
    value.date = new Date(9);
    value.missing = undefined;
    value.later = Promise.resolve(new Box(new Date(10)));
    const result = deserializeLoaderData<Box>(
      await serializeLoaderData(new Box(value)),
    );
    assertInstanceOf(result, Box);
    const restored = result.value as typeof value;
    assert(Object.hasOwn(restored, "__proto__"));
    assertEquals(restored.$t, "Date");
    assertEquals(restored.n, NaN);
    assertEquals(restored.date, new Date(9));
    assert(Object.hasOwn(restored, "missing"));
    assertInstanceOf(restored.later, Promise);
    assertEquals(await restored.later, new Box(new Date(10)));
  });

  it("refuses a serializer whose output matches itself", async () => {
    registerType({
      name: "Box",
      is: (v): v is Box => v instanceof Box,
      serialize: (v) => v,
      deserialize: (v) => v,
    });
    await assertRejects(
      () => serializeLoaderData(new Box(1)),
      Error,
      "matches its own",
    );
    assertThrows(
      () => createStreamingLoaderData(new Box(1)),
      Error,
      "matches its own",
    );
  });

  it("keeps registered names separate from error serializer data", () => {
    class DomainError extends Error {}
    registerError({
      name: "DomainError",
      is: (v): v is DomainError => v instanceof DomainError,
      serialize: () => ({ __errorType: "TypeError", message: "own data" }),
      deserialize: (data) => new DomainError(String(data.__errorType)),
    });
    const serialized = serializeError(new DomainError());
    assertEquals(serialized.__errorType, "DomainError");
    assertEquals(serialized.data, {
      __errorType: "TypeError",
      message: "own data",
    });
    assertInstanceOf(deserializeError(serialized), DomainError);
  });

  it("recursively processes error serializer output on every transport", async () => {
    class DomainError extends Error {
      constructor(public data: Record<string, unknown>) {
        super("domain");
      }
    }
    registerError({
      name: "DomainError",
      is: (value): value is DomainError => value instanceof DomainError,
      serialize: (error) => error.data,
      deserialize: (data) => new DomainError(data),
    });
    const data = {
      __errorType: "TypeError",
      hostile: hostileObjects,
      at: new Date(5),
      missing: undefined,
      later: Promise.resolve(new Date(6)),
    };
    const error = new DomainError(data);
    const hydration = deserializeHydrationData(
      await serializeHydrationData({ matches: [], errors: { root: error } }),
    );
    const settled = deserializeLoaderData(await serializeLoaderData(error));
    const streaming = await deserializeStreamingLoaderData<
      { initial: DomainError; deferred: Promise<DomainError> }
    >(
      new Response(
        createStreamingLoaderData({
          initial: error,
          deferred: Promise.reject(error),
        }),
      ),
    );
    const rejected = await assertRejects(() => streaming.deferred, DomainError);
    for (
      const restored of [
        hydration.errors?.root,
        settled,
        streaming.initial,
        rejected,
      ]
    ) {
      assertInstanceOf(restored, DomainError);
      assertEquals(restored.data.__errorType, "TypeError");
      assertEquals(restored.data.hostile, hostileObjects);
      assertEquals(restored.data.at, new Date(5));
      assert(Object.hasOwn(restored.data, "missing"));
      assertEquals(await restored.data.later, new Date(6));
    }
  });

  it("rejects error serializer output matching its own predicate", async () => {
    class DomainError extends Error {}
    registerError({
      name: "DomainError",
      is: (value): value is DomainError =>
        value instanceof DomainError ||
        !!(value && typeof value === "object" &&
          Object.hasOwn(value, "domain")),
      serialize: () => ({ domain: true }),
      deserialize: () => new DomainError(),
    });
    assertThrows(
      () => serializeError(new DomainError()),
      Error,
      "matches its own",
    );
    await assertRejects(
      () => serializeLoaderData(new DomainError()),
      Error,
      "matches its own",
    );
    assertThrows(
      () => createStreamingLoaderData(new DomainError()),
      Error,
      "matches its own",
    );
  });

  it("preserves an explicitly exposed 500 message through hydration, data and deferred rejection", async () => {
    const error = new HttpError(500, {
      message: "private",
      exposedMessage: "Try again",
    });
    const hydration = deserializeHydrationData(
      await serializeHydrationData({ matches: [], errors: { root: error } }),
    );
    const settled = deserializeLoaderData(await serializeLoaderData(error));
    const streaming = await deserializeStreamingLoaderData<
      { initial: HttpError; deferred: Promise<never> }
    >(
      new Response(
        createStreamingLoaderData({
          initial: error,
          deferred: Promise.reject(error),
        }),
      ),
    );
    const rejected = await assertRejects(
      () => streaming.deferred,
      HttpError,
      "Try again",
    );
    for (
      const restored of [
        hydration.errors?.root,
        settled,
        streaming.initial,
        rejected,
      ]
    ) {
      assertInstanceOf(restored, HttpError);
      assertEquals(restored.message, "Try again");
      assertEquals(restored.exposedMessage, "Try again");
    }
  });

  it("fails closed on unknown type and error registrations", () => {
    assertThrows(
      () =>
        deserializeHydrationData({
          version: 3,
          data: {
            matches: [],
            loaderData: {
              route: { $t: "type", v: { __type: "Absent", data: 1 } },
            },
          },
        }),
      Error,
      "No deserializer registered for type",
    );
    assertThrows(
      () => deserializeError({ __errorType: "Absent", data: {} }),
      Error,
      "No deserializer registered for error",
    );
  });

  it("rejects only a bad stream promise and continues decoding later promises", async () => {
    const lines = [
      { bad: { $t: "pending", v: "a" }, good: { $t: "pending", v: "b" } },
      {
        id: "a",
        status: "resolved",
        value: { $t: "type", v: { __type: "Absent", data: 1 } },
      },
      { id: "b", status: "resolved", value: { $t: "Date", v: 5 } },
    ];
    const result = await deserializeStreamingLoaderData<
      { bad: Promise<unknown>; good: Promise<Date> }
    >(
      new Response(lines.map((line) => JSON.stringify(line)).join("\n") + "\n"),
    );
    await assertRejects(
      () => result.bad,
      Error,
      "No deserializer registered for type",
    );
    assertEquals(await Promise.allSettled([result.good]), [{
      status: "fulfilled",
      value: new Date(5),
    }]);
  });

  it("folds public environment into the only tagged hydration value", async () => {
    const publicEnv = JSON.parse(
      '{"$t":"Date","__proto__":"kept","APP_ENV":"test"}',
    );
    const payload = await serializeHydrationData({ matches: [], publicEnv });
    assertEquals(Object.keys(payload), ["version", "data"]);
    assertEquals(deserializeHydrationData(payload).publicEnv, publicEnv);
  });

  it("runs registered predicates before Array and Date and chooses the first match", async () => {
    for (const name of ["First", "Second"]) {
      registerType<Date | unknown[], string>({
        name,
        is: (v): v is Date | unknown[] => v instanceof Date || Array.isArray(v),
        serialize: () => name,
        deserialize: (v) => [v],
      });
    }
    assertEquals(
      deserializeLoaderData(await serializeLoaderData(new Date(1))),
      ["First"],
    );
    assertEquals(deserializeLoaderData(await serializeLoaderData([1, 2])), [
      "First",
    ]);
  });

  it("discovers promises created by a serializer and streams nested promises progressively", async () => {
    const first = Promise.withResolvers<unknown>();
    const nested = Promise.withResolvers<unknown>();
    registerType({
      name: "Box",
      is: (v): v is Box => v instanceof Box,
      serialize: () => ({ first: first.promise }),
      deserialize: (v) => new Box(v),
    });
    const response = createLoaderDataResponse(new Box(0));
    assertEquals(response.headers.get("Content-Type"), "application/x-ndjson");
    const result = await deserializeStreamingLoaderData<Box>(response);
    const value = result.value as { first: Promise<{ nested: Promise<Date> }> };
    assertInstanceOf(value.first, Promise);
    first.resolve({ nested: nested.promise });
    const next = await value.first;
    assertInstanceOf(next.nested, Promise);
    nested.resolve(new Date(8));
    assertEquals(await next.nested, new Date(8));
  });

  it("encodes deferred values only when the consumer pulls", async () => {
    let serializations = 0;
    registerType({
      name: "Box",
      is: (v): v is Box => v instanceof Box,
      serialize: (v) => {
        serializations++;
        return v.value;
      },
      deserialize: (v) => new Box(v),
    });
    const stream = createStreamingLoaderData({
      later: Promise.resolve(new Box(3)),
    });
    const reader = stream.getReader();
    await delay(0);
    assertEquals(serializations, 0);
    await reader.read();
    await delay(0);
    assertEquals(serializations, 0);
    await reader.read();
    assertEquals(serializations, 1);
    assertEquals((await reader.read()).done, true);
    reader.releaseLock();
  });

  it("aborts a waiting stream and stops processing later resolutions", async () => {
    const controller = new AbortController();
    const later = Promise.withResolvers<unknown>();
    let serializations = 0;
    registerType({
      name: "Box",
      is: (v): v is Box => v instanceof Box,
      serialize: (v) => {
        serializations++;
        return v.value;
      },
      deserialize: (v) => new Box(v),
    });
    const reader = createStreamingLoaderData(
      { later: later.promise },
      controller.signal,
    ).getReader();
    await reader.read();
    const next = reader.read();
    controller.abort(new Error("request ended"));
    await assertRejects(() => next, Error, "request ended");
    later.resolve(new Box(4));
    await delay(0);
    assertEquals(serializations, 0);
    reader.releaseLock();
  });

  it("detaches the request abort listener after cancellation and normal completion", async () => {
    for (const cancel of [true, false]) {
      const controller = new AbortController();
      using removed = stub(
        controller.signal,
        "removeEventListener",
        controller.signal.removeEventListener.bind(controller.signal),
      );
      const stream = createStreamingLoaderData(
        { later: Promise.resolve(1) },
        controller.signal,
      );
      if (cancel) await stream.cancel();
      else await new Response(stream).text();
      assertEquals(
        removed.calls.filter((call) => call.args[0] === "abort").length,
        1,
      );
    }
  });

  it("uses one text decoder for settled text, NDJSON, and byte-split Unicode", async () => {
    const text = JSON.stringify(
      toTaggedJson({ text: "水🌿\nhello", missing: undefined }),
    );
    for (const suffix of ["", "\n"]) {
      const bytes = new TextEncoder().encode(text + suffix);
      const response = new Response(
        new ReadableStream({
          start(c) {
            for (const byte of bytes) c.enqueue(Uint8Array.of(byte));
            c.close();
          },
        }),
      );
      assertEquals(await deserializeStreamingLoaderData(response), {
        text: "水🌿\nhello",
        missing: undefined,
      });
    }
  });

  it("rejects unknown string and obsolete numeric tags", () => {
    for (const tag of [40000, 40002, "Absent"]) {
      assertThrows(
        () => fromTaggedJson({ $t: tag, v: 1 }),
        Error,
        "Unknown tagged JSON tag",
      );
    }
  });

  it("isolates an unknown error registration in a rejected stream line", async () => {
    const lines = [
      { bad: { $t: "pending", v: "a" }, good: { $t: "pending", v: "b" } },
      {
        id: "a",
        status: "rejected",
        error: { __errorType: "Absent", data: {} },
      },
      { id: "b", status: "resolved", value: 7 },
    ];
    const result = await deserializeStreamingLoaderData<
      { bad: Promise<unknown>; good: Promise<number> }
    >(new Response(lines.map((v) => JSON.stringify(v)).join("\n")));
    await assertRejects(
      () => result.bad,
      Error,
      "No deserializer registered for error",
    );
    assertEquals(await result.good, 7);
  });
});
