import {
  assertEquals,
  assertFalse,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { HttpError } from "@udibo/http-error";

import { registerError, registerType } from "./mod.ts";
import {
  deserializeHydrationData,
  resetRegistries,
  type SerializedHydrationData,
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
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value instanceof HttpError
        ? value.exposedMessage
        : value.message,
      ...(value instanceof HttpError ? { status: value.status } : {}),
      ...(value instanceof CustomError ? { code: value.code } : {}),
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

const loneLeadSurrogate = String.fromCharCode(0xd800);
const loneTrailSurrogate = String.fromCharCode(0xdc00);

const ROUND_TRIPS: [string, () => unknown, (() => unknown)?][] = [
  ["a Date", () => new Date("2026-09-11T12:34:56.789Z")],
  ["the epoch", () => new Date(0)],
  ["a Date before the epoch", () => new Date(-1)],
  ["an invalid Date", () => new Date(NaN)],
  ["a bigint in the safe range", () => 123n],
  ["a large negative bigint", () => -(2n ** 53n)],
  ["a large positive bigint", () => 2n ** 53n],
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
  ["an array hole", () => [1, , 3], () => [1, undefined, 3]],
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
  ["a Map, flattened", () => new Map([["a", 1]]), () => ({})],
  ["a Set, flattened", () => new Set([1]), () => ({})],
  ["a RegExp, flattened", () => /x/g, () => ({})],
  ["a URL, flattened", () => new URL("https://example.com/"), () => ({})],
  [
    "a typed array, flattened",
    () => new Uint8Array([1, 2]),
    () => ({ 0: 1, 1: 2 }),
  ],
  ["a class instance, flattened", () =>
    new (class Box {
      inside = 1;
    })(), () => ({ inside: 1 })],
  ["a lone surrogate", () => ({
    [`key${loneLeadSurrogate}`]: `value${loneTrailSurrogate}`,
  }), () => ({ "key�": "value�" })],
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

  describe("round trips the supported values and documented flattening", () => {
    for (const [name, make, expected] of ROUND_TRIPS) {
      it(name, async () => {
        const original = (expected ?? make)();
        const v3 = hydratedValue(await serializeV3(make()));
        assertEquals(await observed(v3), await observed(original));
      });
    }
  });

  for (
    const [name, make] of [
      ["a function", () => () => 1],
      ["a symbol", () => Symbol("private")],
    ] as const
  ) {
    it(`refuses ${name}`, async () => {
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
          { version: 5, data: {} } as unknown as SerializedHydrationData,
        ),
      Error,
      "Unsupported hydration data version: 5",
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
      "Unknown tagged JSON tag: Map",
    );
  });
});

describe("obsolete hydration formats", () => {
  it("refuses a version 2 document without a fallback decoder", () => {
    assertThrows(
      () =>
        deserializeHydrationData({
          version: 2,
          data: "obsolete-base64",
        } as unknown as SerializedHydrationData),
      Error,
      "Unsupported hydration data version: 2",
    );
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
