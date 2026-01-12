import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { HttpError } from "@udibo/http-error";

import {
  cborDecode,
  cborEncode,
  containsPromises,
  createStreamingLoaderData,
  decodeFromBase64,
  deserializeError,
  deserializeHydrationData,
  deserializeStreamingLoaderData,
  encodeToBase64,
  resetRegistries,
  serializeError,
  serializeHydrationData,
} from "./_serialization.ts";

import { registerError, registerType } from "./mod.ts";

describe("Serialization Module", () => {
  beforeEach(() => {
    resetRegistries();
  });

  afterEach(() => {
    resetRegistries();
  });

  describe("cborEncode/cborDecode", () => {
    it("should encode and decode primitive values", () => {
      assertEquals(cborDecode(cborEncode(42)), 42);
      assertEquals(cborDecode(cborEncode("hello")), "hello");
      assertEquals(cborDecode(cborEncode(true)), true);
      assertEquals(cborDecode(cborEncode(null)), null);
      assertEquals(cborDecode(cborEncode(undefined)), undefined);
    });

    it("should encode and decode arrays", () => {
      const input = [1, 2, 3, "a", "b"];
      assertEquals(cborDecode(cborEncode(input)), input);
    });

    it("should encode and decode objects", () => {
      const input = { name: "test", value: 123, nested: { a: 1 } };
      assertEquals(cborDecode(cborEncode(input)), input);
    });

    it("should encode and decode Dates", () => {
      const date = new Date("2025-01-01T00:00:00Z");
      const decoded = cborDecode<Date>(cborEncode(date));
      assertEquals(decoded.toISOString(), date.toISOString());
    });
  });

  describe("encodeToBase64/decodeFromBase64", () => {
    it("should encode and decode to base64 strings", () => {
      const input = { message: "hello world", count: 42 };
      const base64 = encodeToBase64(input);
      assertEquals(typeof base64, "string");
      assertEquals(decodeFromBase64(base64), input);
    });

    it("should handle complex nested structures", () => {
      const input = {
        users: [
          { name: "Alice", age: 30 },
          { name: "Bob", age: 25 },
        ],
        metadata: { version: 1 },
      };
      const base64 = encodeToBase64(input);
      assertEquals(decodeFromBase64(base64), input);
    });
  });

  describe("registerType", () => {
    it("should register a custom type serializer", async () => {
      // Custom class for testing
      class Money {
        constructor(public amount: number, public currency: string) {}
        static isMoney(value: unknown): value is Money {
          return value instanceof Money;
        }
      }

      registerType<Money, { amount: number; currency: string }>({
        name: "Money",
        is: Money.isMoney,
        serialize: (money) => ({
          amount: money.amount,
          currency: money.currency,
        }),
        deserialize: (data) => new Money(data.amount, data.currency),
      });

      // Use hydration data flow to test custom type serialization
      const money = new Money(100, "USD");
      const hydrationData = {
        matches: [{ id: "/" }],
        loaderData: {
          "/": { payment: money },
        },
      };

      const serialized = await serializeHydrationData(hydrationData);
      const deserialized = deserializeHydrationData(serialized);

      const loaderData = deserialized.loaderData?.["/"] as { payment: Money };
      assertEquals(loaderData.payment instanceof Money, true);
      assertEquals(loaderData.payment.amount, 100);
      assertEquals(loaderData.payment.currency, "USD");
    });

    it("should throw when registering duplicate type names", () => {
      registerType({
        name: "TestType",
        is: (_v: unknown): _v is never => false,
        serialize: (v) => v,
        deserialize: (v) => v,
      });

      assertThrows(
        () =>
          registerType({
            name: "TestType",
            is: (_v: unknown): _v is never => false,
            serialize: (v) => v,
            deserialize: (v) => v,
          }),
        Error,
        'Type "TestType" is already registered',
      );
    });
  });

  describe("registerError", () => {
    it("should register a custom error serializer", () => {
      class ValidationError extends Error {
        constructor(message: string, public fields: string[]) {
          super(message);
          this.name = "ValidationError";
        }
      }

      registerError<ValidationError>({
        name: "ValidationError",
        is: (e): e is ValidationError => e instanceof ValidationError,
        serialize: (error) => ({
          message: error.message,
          fields: error.fields,
        }),
        deserialize: (data) =>
          new ValidationError(data.message as string, data.fields as string[]),
      });

      const error = new ValidationError("Invalid input", ["email", "name"]);
      const serialized = serializeError(error);

      assertEquals(serialized.__errorType, "ValidationError");
      assertEquals(serialized.message, "Invalid input");
      assertEquals(serialized.fields, ["email", "name"]);

      const deserialized = deserializeError(serialized) as ValidationError;
      assertEquals(deserialized instanceof ValidationError, true);
      assertEquals(deserialized.message, "Invalid input");
      assertEquals(deserialized.fields, ["email", "name"]);
    });

    it("should throw when registering duplicate error names", () => {
      class TestError extends Error {}

      registerError<TestError>({
        name: "TestError",
        is: (e): e is TestError => e instanceof TestError,
        serialize: (e) => ({ message: e.message }),
        deserialize: (d) => new TestError(d.message as string),
      });

      assertThrows(
        () =>
          registerError<TestError>({
            name: "TestError",
            is: (e): e is TestError => e instanceof TestError,
            serialize: (e) => ({ message: e.message }),
            deserialize: (d) => new TestError(d.message as string),
          }),
        Error,
        'Error "TestError" is already registered',
      );
    });
  });

  describe("serializeError/deserializeError", () => {
    it("should serialize and deserialize HttpError", () => {
      const error = new HttpError(404, "Not Found");
      const serialized = serializeError(error);

      assertEquals(serialized.__errorType, "HttpError");
      assertEquals(serialized.status, 404);
      assertEquals(serialized.message, "Not Found");

      const deserialized = deserializeError(serialized) as HttpError;
      assertEquals(deserialized instanceof HttpError, true);
      assertEquals(deserialized.status, 404);
      assertEquals(deserialized.message, "Not Found");
    });

    it("should serialize and deserialize TypeError", () => {
      const error = new TypeError("Invalid type");
      const serialized = serializeError(error);

      assertEquals(serialized.__errorType, "TypeError");
      assertEquals(serialized.message, "Invalid type");

      const deserialized = deserializeError(serialized) as TypeError;
      assertEquals(deserialized instanceof TypeError, true);
      assertEquals(deserialized.message, "Invalid type");
    });

    it("should serialize and deserialize RangeError", () => {
      const error = new RangeError("Out of range");
      const serialized = serializeError(error);

      assertEquals(serialized.__errorType, "RangeError");
      assertEquals(serialized.message, "Out of range");

      const deserialized = deserializeError(serialized) as RangeError;
      assertEquals(deserialized instanceof RangeError, true);
      assertEquals(deserialized.message, "Out of range");
    });

    it("should serialize and deserialize generic Error", () => {
      const error = new Error("Something went wrong");
      const serialized = serializeError(error);

      assertEquals(serialized.__errorType, "Error");
      assertEquals(serialized.message, "Something went wrong");

      const deserialized = deserializeError(serialized) as Error;
      assertEquals(deserialized instanceof Error, true);
      assertEquals(deserialized.message, "Something went wrong");
    });

    it("should handle non-Error thrown values", () => {
      const thrown = { custom: "error object" };
      const serialized = serializeError(thrown);

      assertEquals(serialized.__errorType, "Unknown");
      assertEquals(serialized.value, thrown);

      const deserialized = deserializeError(serialized);
      assertEquals(deserialized, thrown);
    });
  });

  describe("serializeHydrationData/deserializeHydrationData", () => {
    it("should serialize and deserialize basic hydration data", async () => {
      const hydrationData = {
        matches: [{ id: "/" }, { id: "/index" }],
        loaderData: {
          "/": { title: "Home" },
          "/index": { items: [1, 2, 3] },
        },
      };

      const serialized = await serializeHydrationData(hydrationData);

      assertEquals(serialized.version, 2);
      assertEquals(typeof serialized.data, "string");

      const deserialized = deserializeHydrationData(serialized);
      assertEquals(deserialized.matches, hydrationData.matches);
      assertEquals(deserialized.loaderData, hydrationData.loaderData);
    });

    it("should handle resolved promises", async () => {
      const hydrationData = {
        matches: [{ id: "/" }],
        loaderData: {
          "/": {
            user: Promise.resolve({ name: "Alice" }),
            count: 42,
          },
        },
      };

      const serialized = await serializeHydrationData(hydrationData);
      const deserialized = deserializeHydrationData(serialized);

      // The resolved promise should be reconstructed as a Promise
      const loaderData = deserialized.loaderData?.["/"] as {
        user: Promise<{ name: string }>;
        count: number;
      };
      assertEquals(loaderData.count, 42);
      assertEquals(await loaderData.user, { name: "Alice" });
    });

    it("should handle rejected promises", async () => {
      const hydrationData = {
        matches: [{ id: "/" }],
        loaderData: {
          "/": {
            data: Promise.reject(new Error("Failed to load")),
          },
        },
      };

      const serialized = await serializeHydrationData(hydrationData);
      const deserialized = deserializeHydrationData(serialized);

      const loaderData = deserialized.loaderData?.["/"] as {
        data: Promise<unknown>;
      };

      await assertRejects(
        async () => await loaderData.data,
        Error,
        "Failed to load",
      );
    });

    it("should preserve publicEnv", async () => {
      const hydrationData = {
        matches: [],
        publicEnv: { APP_NAME: "TestApp", NODE_ENV: "test" },
      };

      const serialized = await serializeHydrationData(hydrationData);
      const deserialized = deserializeHydrationData(serialized);

      assertEquals(deserialized.publicEnv, hydrationData.publicEnv);
    });

    it("should handle errors in hydration data", async () => {
      const hydrationData = {
        matches: [{ id: "/" }],
        errors: {
          "/": new HttpError(500, "Internal Server Error"),
        },
      };

      const serialized = await serializeHydrationData(hydrationData);
      const deserialized = deserializeHydrationData(serialized);

      const error = deserialized.errors?.["/"] as HttpError;
      assertEquals(error instanceof HttpError, true);
      assertEquals(error.status, 500);
      assertEquals(error.message, "Internal Server Error");
    });

    it("should handle custom types in loader data", async () => {
      // Register a custom type
      class Point {
        constructor(public x: number, public y: number) {}
        static isPoint(value: unknown): value is Point {
          return value instanceof Point;
        }
      }

      registerType<Point, { x: number; y: number }>({
        name: "Point",
        is: Point.isPoint,
        serialize: (p) => ({ x: p.x, y: p.y }),
        deserialize: (d) => new Point(d.x, d.y),
      });

      const hydrationData = {
        matches: [{ id: "/" }],
        loaderData: {
          "/": {
            location: new Point(10, 20),
          },
        },
      };

      const serialized = await serializeHydrationData(hydrationData);
      const deserialized = deserializeHydrationData(serialized);

      const loaderData = deserialized.loaderData?.["/"] as {
        location: Point;
      };
      assertEquals(loaderData.location instanceof Point, true);
      assertEquals(loaderData.location.x, 10);
      assertEquals(loaderData.location.y, 20);
    });
  });

  describe("resetRegistries", () => {
    it("should clear custom registrations and restore built-ins", () => {
      // Register a custom type
      registerType({
        name: "CustomType",
        is: (_v: unknown): _v is never => false,
        serialize: (v) => v,
        deserialize: (v) => v,
      });

      // Reset should clear custom registrations
      resetRegistries();

      // Should be able to register the same name again
      registerType({
        name: "CustomType",
        is: (_v: unknown): _v is never => false,
        serialize: (v) => v,
        deserialize: (v) => v,
      });

      // Built-in error serializers should still work
      const error = new HttpError(400, "Bad Request");
      const serialized = serializeError(error);
      assertEquals(serialized.__errorType, "HttpError");
    });
  });

  describe("containsPromises", () => {
    it("should return false for primitive values", () => {
      assertEquals(containsPromises(42), false);
      assertEquals(containsPromises("hello"), false);
      assertEquals(containsPromises(true), false);
      assertEquals(containsPromises(null), false);
      assertEquals(containsPromises(undefined), false);
    });

    it("should return true for a Promise", () => {
      assertEquals(containsPromises(Promise.resolve("test")), true);
    });

    it("should return true for an object containing a Promise", () => {
      assertEquals(
        containsPromises({ data: "sync", deferred: Promise.resolve("async") }),
        true,
      );
    });

    it("should return false for an object without Promises", () => {
      assertEquals(containsPromises({ data: "sync", count: 42 }), false);
    });

    it("should return true for nested Promise in array", () => {
      assertEquals(containsPromises([1, 2, Promise.resolve(3)]), true);
    });

    it("should return true for deeply nested Promise", () => {
      assertEquals(
        containsPromises({
          level1: { level2: { deferred: Promise.resolve() } },
        }),
        true,
      );
    });
  });

  describe("createStreamingLoaderData/deserializeStreamingLoaderData", () => {
    it("should stream data without promises as single chunk", async () => {
      const data = { message: "hello", count: 42 };
      const stream = createStreamingLoaderData(data);

      // Create a mock Response from the stream
      const response = new Response(stream, {
        headers: { "Content-Type": "application/cbor-stream" },
      });

      const result = await deserializeStreamingLoaderData(response);
      assertEquals(result, data);
    });

    it("should stream data with resolved promise", async () => {
      const data = {
        sync: "immediate",
        deferred: Promise.resolve("delayed value"),
      };

      const stream = createStreamingLoaderData(data);
      const response = new Response(stream, {
        headers: { "Content-Type": "application/cbor-stream" },
      });

      const result = await deserializeStreamingLoaderData<{
        sync: string;
        deferred: Promise<string>;
      }>(response);

      assertEquals(result.sync, "immediate");
      // The deferred value should be a Promise
      assertEquals(result.deferred instanceof Promise, true);
      // And should resolve to the correct value
      assertEquals(await result.deferred, "delayed value");
    });

    it("should handle multiple deferred promises", async () => {
      const data = {
        fast: Promise.resolve("fast result"),
        slow: Promise.resolve("slow result"),
        sync: "sync data",
      };

      const stream = createStreamingLoaderData(data);
      const response = new Response(stream, {
        headers: { "Content-Type": "application/cbor-stream" },
      });

      const result = await deserializeStreamingLoaderData<{
        fast: Promise<string>;
        slow: Promise<string>;
        sync: string;
      }>(response);

      assertEquals(result.sync, "sync data");
      assertEquals(await result.fast, "fast result");
      assertEquals(await result.slow, "slow result");
    });

    it("should handle rejected promises", async () => {
      const data = {
        willFail: Promise.reject(new Error("Something went wrong")),
      };

      const stream = createStreamingLoaderData(data);
      const response = new Response(stream, {
        headers: { "Content-Type": "application/cbor-stream" },
      });

      const result = await deserializeStreamingLoaderData<{
        willFail: Promise<string>;
      }>(response);

      await assertRejects(
        async () => await result.willFail,
        Error,
        "Something went wrong",
      );
    });

    it("should handle HttpError in rejected promise", async () => {
      const data = {
        willFail: Promise.reject(new HttpError(404, "Not Found")),
      };

      const stream = createStreamingLoaderData(data);
      const response = new Response(stream, {
        headers: { "Content-Type": "application/cbor-stream" },
      });

      const result = await deserializeStreamingLoaderData<{
        willFail: Promise<string>;
      }>(response);

      try {
        await result.willFail;
        throw new Error("Should have thrown");
      } catch (error) {
        assertEquals(error instanceof HttpError, true);
        assertEquals((error as HttpError).status, 404);
        assertEquals((error as HttpError).message, "Not Found");
      }
    });

    it("should handle nested promises in arrays", async () => {
      const data = {
        items: [
          Promise.resolve("first"),
          Promise.resolve("second"),
        ],
      };

      const stream = createStreamingLoaderData(data);
      const response = new Response(stream, {
        headers: { "Content-Type": "application/cbor-stream" },
      });

      const result = await deserializeStreamingLoaderData<{
        items: Promise<string>[];
      }>(response);

      assertEquals(await result.items[0], "first");
      assertEquals(await result.items[1], "second");
    });

    it("should handle custom types in deferred data", async () => {
      // Register a custom type
      class Point {
        constructor(public x: number, public y: number) {}
        static isPoint(value: unknown): value is Point {
          return value instanceof Point;
        }
      }

      registerType<Point, { x: number; y: number }>({
        name: "Point",
        is: Point.isPoint,
        serialize: (p) => ({ x: p.x, y: p.y }),
        deserialize: (d) => new Point(d.x, d.y),
      });

      const data = {
        location: Promise.resolve(new Point(10, 20)),
      };

      const stream = createStreamingLoaderData(data);
      const response = new Response(stream, {
        headers: { "Content-Type": "application/cbor-stream" },
      });

      const result = await deserializeStreamingLoaderData<{
        location: Promise<Point>;
      }>(response);

      const point = await result.location;
      assertEquals(point instanceof Point, true);
      assertEquals(point.x, 10);
      assertEquals(point.y, 20);
    });

    it("should resolve promises in completion order for streaming", async () => {
      // Use delays to test that promises resolve independently
      const { promise: slowPromise, resolve: slowResolve } = Promise
        .withResolvers<string>();
      const { promise: fastPromise, resolve: fastResolve } = Promise
        .withResolvers<string>();

      const data = {
        slow: slowPromise,
        fast: fastPromise,
      };

      const stream = createStreamingLoaderData(data);
      const response = new Response(stream, {
        headers: { "Content-Type": "application/cbor-stream" },
      });

      const result = await deserializeStreamingLoaderData<{
        slow: Promise<string>;
        fast: Promise<string>;
      }>(response);

      // Resolve fast before slow
      fastResolve("fast result");
      assertEquals(await result.fast, "fast result");

      // Then resolve slow
      slowResolve("slow result");
      assertEquals(await result.slow, "slow result");
    });
  });
});
