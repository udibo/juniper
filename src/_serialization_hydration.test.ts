import {
  assert,
  assertEquals,
  assertFalse,
  assertInstanceOf,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { HttpError } from "@udibo/http-error";

import { registerError, registerType } from "./mod.ts";
import {
  deserializeHydrationData,
  encodeToBase64,
  processHydrationData,
  resetRegistries,
  type SerializedHydrationData,
  type SerializedHydrationDataV2,
  serializeHydrationData,
  toInlineScriptJson,
} from "./_serialization.ts";

class Point {
  constructor(public x: number, public y: number) {}
}

class CustomError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "CustomError";
  }
}

function registerFixtures(): void {
  registerType<Point, { x: number; y: number }>({
    name: "Point",
    is: (value): value is Point => value instanceof Point,
    serialize: (point) => ({ x: point.x, y: point.y }),
    deserialize: (data) => new Point(data.x, data.y),
  });
  registerType<{ raw: unknown }, unknown>({
    name: "Raw",
    is: (value): value is { raw: unknown } =>
      value !== null && typeof value === "object" && "raw" in value &&
      Object.keys(value).length === 1,
    serialize: (value) => value.raw,
    deserialize: (data) => ({ raw: data }),
  });
  registerError<CustomError>({
    name: "CustomError",
    is: (error): error is CustomError => error instanceof CustomError,
    serialize: (error) => ({ message: error.message, code: error.code }),
    deserialize: (data) =>
      new CustomError(data.message as string, data.code as string),
  });
}

function asEmbeddedInTheDocument(
  serialized: SerializedHydrationData,
): SerializedHydrationData {
  return new Function(`return ${toInlineScriptJson(serialized)};`)();
}

async function serializeV2(
  loaderValue: unknown,
): Promise<SerializedHydrationDataV2> {
  return {
    version: 2,
    data: encodeToBase64(
      await processHydrationData({
        matches: [{ id: "/" }],
        loaderData: { "/": { value: loaderValue } },
      }),
    ),
  };
}

async function serializeV3(
  loaderValue: unknown,
): Promise<SerializedHydrationData> {
  return await serializeHydrationData({
    matches: [{ id: "/" }],
    loaderData: { "/": { value: loaderValue } },
  });
}

function hydratedValue(serialized: SerializedHydrationData): unknown {
  const { loaderData } = deserializeHydrationData(
    asEmbeddedInTheDocument(serialized),
  );
  return (loaderData?.["/"] as { value: unknown }).value;
}

async function observed(value: unknown): Promise<unknown> {
  if (value instanceof Promise) {
    try {
      return { resolved: await observed(await value) };
    } catch (error) {
      return { rejected: await observed(error) };
    }
  }
  if (value === null) return null;
  switch (typeof value) {
    case "number":
      return { number: Object.is(value, -0) ? "-0" : String(value) };
    case "bigint":
      return { bigint: String(value) };
    case "undefined":
      return { undefined: true };
    case "string":
    case "boolean":
      return value;
  }
  if (value instanceof Date) return { Date: String(value.getTime()) };
  if (Array.isArray(value)) {
    return {
      array: await Promise.all(Array.from(value, observed)),
      holes: value.length - Object.keys(value).length,
    };
  }
  const object = value as Record<string, unknown>;
  const prototype = Object.getPrototypeOf(object);
  const own: [string, unknown][] = [];
  for (const key of Object.getOwnPropertyNames(object)) {
    own.push([
      key,
      await observed(Object.getOwnPropertyDescriptor(object, key)?.value),
    ]);
  }
  return {
    constructor: prototype === null ? null : prototype.constructor?.name,
    plainPrototype: prototype === Object.prototype,
    inherited: prototype && prototype !== Object.prototype &&
        prototype.constructor === Object
      ? await observed({ ...prototype })
      : undefined,
    message: object instanceof Error ? object.message : undefined,
    exposedMessage: object instanceof HttpError
      ? object.exposedMessage
      : undefined,
    own,
  };
}

function rejectedWith(error: unknown): Promise<never> {
  const promise = Promise.reject(error);
  promise.catch(() => {});
  return promise;
}

const ROUND_TRIPS: [string, () => unknown][] = [
  ["a Date", () => new Date("2026-09-11T12:34:56.789Z")],
  ["the epoch", () => new Date(0)],
  ["a Date before the epoch", () => new Date(-1)],
  ["an invalid Date", () => new Date(NaN)],
  ["a bigint in the safe range, as CBOR collapses it", () => 123n],
  ["the lowest bigint CBOR collapses", () => -(2n ** 53n)],
  ["the lowest bigint CBOR keeps", () => 2n ** 53n],
  ["a bigint beyond 64 bits", () => 2n ** 64n],
  ["a negative bigint beyond 64 bits", () => -(2n ** 64n) - 1n],
  ["NaN", () => NaN],
  ["Infinity", () => Infinity],
  ["-Infinity", () => -Infinity],
  ["-0", () => -0],
  ["an unsafe integer number", () => 2 ** 60],
  ["a fraction", () => 1.5],
  ["undefined", () => undefined],
  ["a key whose value is undefined", () => ({ kept: undefined })],
  ["an array hole", () => [1, , 3]],
  ["an Error", () => new Error("plain")],
  ["a TypeError", () => new TypeError("typed")],
  ["an HttpError", () => new HttpError(404, "Missing")],
  [
    "an HttpError with an internal message",
    () => new HttpError(500, "pool exhausted on shard 7"),
  ],
  ["an HttpError with an exposed message", () =>
    new HttpError(400, {
      message: "internal",
      exposedMessage: "Try again",
      instance: "/probe",
    })],
  ["a registered error", () => new CustomError("custom", "E42")],
  ["a resolved promise", () => Promise.resolve(new Date(0))],
  ["a rejected promise", () => rejectedWith(new HttpError(403, "Forbidden"))],
  ["a promise rejected with a non-error", () => rejectedWith("plain reason")],
  ["a registered type", () => new Point(10, 20)],
  ["a registered type whose data carries tagged values", () => ({
    raw: { at: new Date(0), big: 2n ** 64n, nan: NaN, gone: undefined },
  })],
  ["a plain object that has the tag key", () => ({ $t: 1, v: 2 })],
  ["a plain object shaped like a tagged Date", () => ({ $t: "Date", v: 0 })],
  ["a tag-keyed object inside registered data", () => ({
    raw: { $t: "undefined" },
  })],
  ["an own __proto__ key inside registered data", () => ({
    raw: JSON.parse('{"__proto__":{"polluted":true},"kept":1}'),
  })],
  [
    "an own __proto__ key in loader data",
    () => JSON.parse('{"__proto__":{"polluted":true},"kept":1}'),
  ],
  ["a Map, flattened", () => new Map([["a", 1]])],
  ["a Set, flattened", () => new Set([1])],
  ["a RegExp, flattened", () => /x/g],
  ["a URL, flattened", () => new URL("https://example.com/")],
  ["a typed array, flattened", () => new Uint8Array([1, 2])],
  ["a class instance, flattened", () =>
    new (class Box {
      inside = 1;
    })()],
  ["a lone surrogate", () => ({ "key\uD800": "value\uDC00" })],
  ["markup and line separators", () => "</script><!--<script>\u2028\u2029"],
  ["nested data", () => ({
    list: [{ at: new Date(1), n: [NaN, -0, undefined] }],
    deep: { deeper: { big: 2n ** 70n } },
  })],
];

describe("hydration payload version 3", () => {
  beforeEach(() => {
    resetRegistries();
    registerFixtures();
  });

  afterEach(() => {
    resetRegistries();
  });

  describe("hydrates every value exactly as version 2 did", () => {
    for (const [name, make] of ROUND_TRIPS) {
      it(name, async () => {
        const v2 = hydratedValue(await serializeV2(make()));
        const v3 = hydratedValue(await serializeV3(make()));
        assertEquals(await observed(v3), await observed(v2));
      });
    }
  });

  for (
    const [name, make] of [
      ["a function", () => () => 1],
      ["a symbol", () => Symbol("private")],
    ] as const
  ) {
    it(`refuses ${name}, as version 2 did`, async () => {
      await assertRejects(() => serializeV2({ inside: make() }));
      await assertRejects(() => serializeV3({ inside: make() }), TypeError);
    });
  }

  it("writes loader text into the payload as readable text", async () => {
    const serialized = await serializeV3({ prose: "Readable by brotli" });
    assertEquals(serialized.version, 3);
    assertStringIncludes(JSON.stringify(serialized), "Readable by brotli");
  });

  it("escapes a plain object that carries the tag key", async () => {
    const serialized = await serializeV3({ $t: "Date", v: 0 });
    assertStringIncludes(
      JSON.stringify(serialized),
      '{"$t":"object","v":[["$t","Date"],["v",0]]}',
    );
    assertEquals(hydratedValue(serialized), { $t: "Date", v: 0 });
  });

  it("refuses a payload version it does not know", () => {
    assertThrows(
      () =>
        deserializeHydrationData(
          { version: 4, data: {} } as unknown as SerializedHydrationData,
        ),
      Error,
      "Unsupported hydration data version: 4",
    );
  });

  it("refuses a tag it does not know", () => {
    assertThrows(
      () =>
        deserializeHydrationData({
          version: 3,
          data: { matches: [], loaderData: { $t: "Map", v: [] } },
        }),
      Error,
      "Unknown hydration data tag: Map",
    );
  });
});

const GOLDEN_V2: SerializedHydrationDataV2 = {
  version: 2,
  data:
    "pXFzZXJpYWxpemVkQ29udGV4dKFkdXNlcqFkbmFtZWNBZGFnbWF0Y2hlc4GhYmlkYS9qbG9hZGVyRGF0YaFhL6pkZGF0ZcH7Qdqo/VwyfvpnbWlzc2luZ/djbmFu+X4AbG5lZ2F0aXZlWmVyb/mAAGVzbWFsbBh7Y2JpZ8JJAQAAAAAAAAAAZXBvaW502ZxComZfX3R5cGVlUG9pbnRkZGF0YaJheAFheQJlZXJyb3LZnEOka19fZXJyb3JUeXBlaUh0dHBFcnJvcmdtZXNzYWdlZ01pc3Npbmdmc3RhdHVzGQGUZmV4cG9zZfVoZGVmZXJyZWTZnEDBAGZmYWlsZWTZnEGka19fZXJyb3JUeXBlaUh0dHBFcnJvcmdtZXNzYWdlaUZvcmJpZGRlbmZzdGF0dXMZAZNmZXhwb3Nl9WdidWlsZElkZ2J1aWxkLTFmZXJyb3JzoWEv2ZxDpGtfX2Vycm9yVHlwZWlIdHRwRXJyb3JnbWVzc2FnZXgvVGhlIHNlcnZlciBlbmNvdW50ZXJlZCBhbiB1bmV4cGVjdGVkIGNvbmRpdGlvbi5mc3RhdHVzGQH0ZmV4cG9zZfU=",
  publicEnv: { APP_NAME: "Golden" },
};

describe("hydration payload version 2", () => {
  beforeEach(() => {
    resetRegistries();
    registerFixtures();
  });

  afterEach(() => {
    resetRegistries();
  });

  it("still hydrates a document rendered by Juniper 0.11.5", async () => {
    const hydration = deserializeHydrationData(
      asEmbeddedInTheDocument(GOLDEN_V2),
    );
    assertEquals(hydration.publicEnv, { APP_NAME: "Golden" });
    assertEquals(hydration.buildId, "build-1");
    assertEquals(hydration.matches, [{ id: "/" }]);
    assertEquals(hydration.serializedContext, { user: { name: "Ada" } });

    const data = hydration.loaderData?.["/"] as Record<string, unknown>;
    assertInstanceOf(data.date, Date);
    assertEquals(data.date.toISOString(), "2026-09-11T12:34:56.789Z");
    assert(Object.hasOwn(data, "missing") && data.missing === undefined);
    assert(Number.isNaN(data.nan));
    assert(Object.is(data.negativeZero, -0));
    assertEquals(data.small, 123);
    assertEquals(data.big, 2n ** 64n);
    assertInstanceOf(data.point, Point);
    assertEquals({ ...data.point }, { x: 1, y: 2 });
    assertInstanceOf(data.error, HttpError);
    assertEquals([data.error.status, data.error.message], [404, "Missing"]);
    assertEquals(((await data.deferred) as Date).getTime(), 0);
    await assertRejects(
      () => data.failed as Promise<unknown>,
      HttpError,
      "Forbidden",
    );
    const error = hydration.errors?.["/"];
    assertInstanceOf(error, HttpError);
    assertEquals(error.message, new HttpError(500).exposedMessage);
  });
});

describe("toInlineScriptJson", () => {
  const hostile = "</script><script>alert(1)</script><!--<script>\u2028\u2029";

  it("writes no character that can end or re-enter the script element", () => {
    const text = toInlineScriptJson({ hostile });
    assertFalse(text.includes("<"));
    assertFalse(text.includes("\u2028"));
    assertFalse(text.includes("\u2029"));
  });

  it("still reads back as the same value", () => {
    assertEquals(JSON.parse(toInlineScriptJson({ hostile })), { hostile });
    assertEquals(new Function(`return ${toInlineScriptJson({ hostile })};`)(), {
      hostile,
    });
  });
});
