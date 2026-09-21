import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
import { registerError, registerType } from "@udibo/juniper";
import { getEnv, isProduction } from "@udibo/juniper/utils/env";
import { simulateEnvironment } from "@udibo/juniper/utils/testing";
import {
  createStreamingLoaderData,
  deserializeError,
  deserializeHydrationData,
  deserializeLoaderData,
  deserializeStreamingLoaderData,
  prepareHydrationData,
  resetRegistries,
  serializeError,
  serializeHydrationData,
  serializeLoaderData,
} from "./_serialization.ts";
import { env } from "./utils/_env.ts";

describe("tagged JSON review regressions", () => {
  beforeEach(resetRegistries);
  afterEach(resetRegistries);

  it("round-trips a registered error named Unknown and fails closed when its decoder is missing", async () => {
    class DomainError extends Error {}
    registerError({
      name: "Unknown",
      is: (value): value is DomainError => value instanceof DomainError,
      serialize: () => ({ message: "domain" }),
      deserialize: (data) => new DomainError(String(data.message)),
    });
    const error = new DomainError("domain");
    assertEquals(
      deserializeError(serializeError("plain failure")),
      "plain failure",
    );
    const encoded = serializeError(error);
    const hydration = await serializeHydrationData({
      matches: [],
      errors: { root: error },
    });
    const text = await serializeLoaderData(error);
    const stream = await new Response(
      createStreamingLoaderData({
        error: Promise.reject(error),
        good: Promise.resolve(5),
      }),
    ).text();
    assertInstanceOf(deserializeError(encoded), DomainError);
    assertInstanceOf(
      deserializeHydrationData(hydration).errors?.root,
      DomainError,
    );
    assertInstanceOf(deserializeLoaderData(text), DomainError);
    const restored = await deserializeStreamingLoaderData<
      { error: Promise<never>; good: Promise<number> }
    >(new Response(stream));
    await assertRejects(() => restored.error, DomainError, "domain");
    resetRegistries();
    assertThrows(
      () => deserializeError(encoded),
      Error,
      'No deserializer registered for error "Unknown"',
    );
    assertThrows(
      () => deserializeLoaderData(text),
      Error,
      'No deserializer registered for error "Unknown"',
    );
    const missing = await deserializeStreamingLoaderData<typeof restored>(
      new Response(stream),
    );
    await assertRejects(
      () => missing.error,
      Error,
      'No deserializer registered for error "Unknown"',
    );
    assertEquals(await missing.good, 5);
  });

  it("keeps public environment strings readable when application strings have a serializer", async () => {
    registerType<string, number[]>({
      name: "Strings",
      is: (value): value is string => typeof value === "string",
      serialize: (value) => [...value].map((c) => c.codePointAt(0)!),
      deserialize: (data) => String.fromCodePoint(...data),
    });
    const payload = await serializeHydrationData({
      matches: [],
      publicEnv: { APP_ENV: "production" },
    });
    using _browser = stub(env, "isServer", () => false);
    using _payload = stub(env, "getHydrationData", () => payload);
    assertEquals(getEnv("APP_ENV"), "production");
    assertEquals(isProduction(), true);
  });

  it("reads browser public environment from a version 4 payload with deferred data", () => {
    const { serialized } = prepareHydrationData({
      matches: [],
      loaderData: { "/": { later: Promise.resolve(1) } },
      publicEnv: { APP_ENV: "production" },
    });
    assertEquals(serialized.version, 4);
    using _browser = stub(env, "isServer", () => false);
    using _payload = stub(env, "getHydrationData", () => serialized);
    assertEquals(getEnv("APP_ENV"), "production");
  });

  it(
    "logs missing registrations even when application arrays have a serializer",
    simulateEnvironment({ APP_ENV: "development" }, async () => {
      registerType<unknown[], string>({
        name: "Arrays",
        is: Array.isArray,
        serialize: JSON.stringify,
        deserialize: JSON.parse,
      });
      const payload = await serializeHydrationData({ matches: [] });
      resetRegistries();
      using logged = stub(console, "error");
      assertThrows(
        () => deserializeHydrationData(payload),
        Error,
        'No deserializer registered for type "Arrays"',
      );
      assertEquals(logged.calls.map((call) => call.args[0]), [
        "Missing Juniper registrations: type:Arrays",
      ]);
    }),
  );

  it("closes after rejecting a deferred value whose encoding discovered unreachable nested promises", async () => {
    using time = new FakeTime();
    const bad = Promise.withResolvers<unknown>();
    const never = Promise.withResolvers<unknown>();
    const reader = new Response(
      createStreamingLoaderData({ bad: bad.promise, good: Promise.resolve(5) }),
    ).body!.pipeThrough(new TextDecoderStream()).getReader();
    await reader.read();
    bad.resolve({ nested: never.promise, invalid: Symbol("unsupported") });
    const lines = [
      JSON.parse((await reader.read()).value!),
      JSON.parse((await reader.read()).value!),
    ];
    assertEquals(lines.map((line) => [line.id, line.status]).sort(), [[
      "p0",
      "rejected",
    ], ["p1", "resolved"]]);
    let closed = false;
    const ending = reader.read().then((result) => {
      closed = result.done;
    });
    try {
      await time.tickAsync(1);
      assertEquals(closed, true);
    } finally {
      await reader.cancel();
      await ending;
      reader.releaseLock();
    }
  });
});
