import {
  assert,
  assertEquals,
  assertFalse,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { createContext, RouterContextProvider } from "react-router";

import { registerContext } from "@udibo/juniper";

import {
  deserializeAllContext,
  deserializeHydrationData,
  resetRegistries,
  serializeAllContext,
  serializeHydrationData,
  toInlineScriptJson,
} from "./_serialization.ts";

const names = [
  "locale",
  "constructor",
  "toString",
  "hasOwnProperty",
  "__proto__",
] as const;

async function roundtripRecord(
  record: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const serialized = await serializeHydrationData({
    matches: [],
    serializedContext: record,
  });
  const restored = deserializeHydrationData(
    JSON.parse(toInlineScriptJson(serialized)),
  );
  assert(restored.serializedContext !== null);
  assert(typeof restored.serializedContext === "object");
  return restored.serializedContext as Record<string, unknown>;
}

describe("registered context hydration", () => {
  beforeEach(resetRegistries);
  afterEach(resetRegistries);

  for (const name of names) {
    for (const omission of ["unset", "undefined", "throws"] as const) {
      it(`decodes an omitted ${name} as undefined when ${omission}`, async () => {
        const context = createContext<unknown>();
        const encoded: unknown[] = [];
        const decoded: unknown[] = [];
        const fallback = `fallback:${name}`;
        registerContext<unknown, unknown>({
          name,
          context,
          serialize(value) {
            encoded.push(value);
            if (omission === "throws") throw new Error("Fixture refused");
            return undefined;
          },
          deserialize(value) {
            decoded.push(value);
            return value === undefined ? fallback : value;
          },
        });
        const server = new RouterContextProvider();
        if (omission !== "unset") server.set(context, "owned-value");
        const restored = await roundtripRecord(serializeAllContext(server));
        assertEquals(encoded, omission === "unset" ? [] : ["owned-value"]);
        assertFalse(Object.hasOwn(restored, name));
        const client = new RouterContextProvider();
        deserializeAllContext(restored, client);
        assertEquals(decoded, [undefined]);
        assertEquals(client.get(context), fallback);
      });
    }

    for (const source of ["own", "default"] as const) {
      it(`preserves the ${source} ${name} value through hydration`, async () => {
        const value = { name, text: "</script>\u2028\u2029", $t: "owned" };
        const context = source === "default"
          ? createContext<unknown>(value)
          : createContext<unknown>();
        const decoded: unknown[] = [];
        registerContext<unknown, unknown>({
          name,
          context,
          serialize: (value) => value,
          deserialize(value) {
            decoded.push(value);
            return value;
          },
        });
        const server = new RouterContextProvider();
        if (source === "own") server.set(context, value);
        const restored = await roundtripRecord(serializeAllContext(server));
        assert(Object.hasOwn(restored, name));
        assertEquals(Object.getPrototypeOf(restored), Object.prototype);
        assertEquals(restored[name], value);
        const client = new RouterContextProvider();
        deserializeAllContext(restored, client);
        assertEquals(decoded, [value]);
        assertEquals(client.get(context), value);
      });
    }
  }

  for (const value of [null, false, 0, ""] as const) {
    it(`preserves own constructor value ${JSON.stringify(value)}`, async () => {
      const context = createContext<unknown>();
      const decoded: unknown[] = [];
      registerContext<unknown, unknown>({
        name: "constructor",
        context,
        serialize: (value) => value,
        deserialize(value) {
          decoded.push(value);
          return value === undefined ? "fallback" : value;
        },
      });
      const server = new RouterContextProvider();
      server.set(context, value);
      const restored = await roundtripRecord(serializeAllContext(server));
      assert(Object.hasOwn(restored, "constructor"));
      const client = new RouterContextProvider();
      deserializeAllContext(restored, client);
      assertEquals(decoded, [value]);
      assertEquals(client.get(context), value);
    });
  }

  it("decodes every registration as undefined when the entire record is absent", async () => {
    const decoded: unknown[] = [];
    const contexts = names.map((name) => {
      const context = createContext<unknown>();
      registerContext<unknown, unknown>({
        name,
        context,
        serialize: (value) => value,
        deserialize(value) {
          decoded.push([name, value]);
          return value === undefined ? `fallback:${name}` : value;
        },
      });
      return { name, context };
    });
    const serialized = await serializeHydrationData({ matches: [] });
    const restored = deserializeHydrationData(
      JSON.parse(toInlineScriptJson(serialized)),
    );
    assertEquals(restored.serializedContext, undefined);
    const client = new RouterContextProvider();
    deserializeAllContext(undefined, client);
    assertEquals(decoded, names.map((name) => [name, undefined]));
    for (const { name, context } of contexts) {
      assertEquals(client.get(context), `fallback:${name}`);
    }
  });

  it("preserves an own undefined value without reading an inherited constructor", async () => {
    const context = createContext<unknown>();
    const decoded: unknown[] = [];
    registerContext<unknown, unknown>({
      name: "constructor",
      context,
      serialize: (value) => value,
      deserialize(value) {
        decoded.push(value);
        return value === undefined ? "fallback" : value;
      },
    });
    const input = { constructor: undefined };
    const restored = await roundtripRecord(input);
    assert(Object.hasOwn(restored, "constructor"));
    const client = new RouterContextProvider();
    deserializeAllContext(restored, client);
    assertEquals(decoded, [undefined]);
    assertEquals(client.get(context), "fallback");
  });

  it("propagates the original synchronous decoder exception", async () => {
    const context = createContext<unknown>();
    const refusal = new Error("Fixture decoder refused");
    registerContext<unknown, unknown>({
      name: "constructor",
      context,
      serialize: (value) => value,
      deserialize() {
        throw refusal;
      },
    });
    const server = new RouterContextProvider();
    server.set(context, "owned-value");
    const restored = await roundtripRecord(serializeAllContext(server));
    const client = new RouterContextProvider();
    assertStrictEquals(
      assertThrows(() => deserializeAllContext(restored, client)),
      refusal,
    );
  });
});
