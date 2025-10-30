import { assertEquals, assertThrows } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";

import { isBrowser, isServer } from "@udibo/juniper/utils/env";
import {
  simulateBrowser,
  simulateEnvironment,
} from "@udibo/juniper/utils/testing";

import type { ClientGlobals, HydrationData } from "../_client.tsx";
import { serializeHydrationData } from "../_server.tsx";

describe("simulateEnvironment", () => {
  const originalEnv = Deno.env.toObject();

  beforeEach(() => {
    Deno.env.set("FOO", "bar");
    Deno.env.set("BAZ", "qux");
    Deno.env.delete("QUUX");
    Deno.env.delete("ABCD");
  });

  afterEach(() => {
    for (const key of Object.keys(Deno.env.toObject())) {
      Deno.env.delete(key);
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      Deno.env.set(key, value);
    }
  });

  it("should simulate environment variables with manual restore", () => {
    const env = simulateEnvironment({
      "FOO": "foo",
      "BAZ": null,
      "QUUX": "quux",
    });

    assertEquals(Deno.env.get("FOO"), "foo");
    assertEquals(Deno.env.get("BAZ"), undefined);
    assertEquals(Deno.env.get("QUUX"), "quux");
    assertEquals(Deno.env.get("ABCD"), undefined);

    Deno.env.set("ABCD", "abcd");
    assertEquals(Deno.env.get("ABCD"), "abcd");

    env.restore();

    assertEquals(Deno.env.get("FOO"), "bar");
    assertEquals(Deno.env.get("BAZ"), "qux");
    assertEquals(Deno.env.get("QUUX"), undefined);
    assertEquals(Deno.env.get("ABCD"), undefined);
  });

  it("should simulate environment variables with automatic restore using 'using'", () => {
    {
      using _env = simulateEnvironment({
        "FOO": "foo",
        "BAZ": null,
        "QUUX": "quux",
      });

      assertEquals(Deno.env.get("FOO"), "foo");
      assertEquals(Deno.env.get("BAZ"), undefined);
      assertEquals(Deno.env.get("QUUX"), "quux");

      Deno.env.set("ABCD", "abcd");
      assertEquals(Deno.env.get("ABCD"), "abcd");
    }

    assertEquals(Deno.env.get("FOO"), "bar");
    assertEquals(Deno.env.get("BAZ"), "qux");
    assertEquals(Deno.env.get("QUUX"), undefined);
    assertEquals(Deno.env.get("ABCD"), undefined);
  });

  it("should throw error when trying to restore environment multiple times", () => {
    const env = simulateEnvironment({
      "FOO": "foo",
    });

    env.restore();

    assertThrows(() => env.restore(), Error, "Environment already restored");
  });

  it("should support nested simulated environments", () => {
    const outerEnv = simulateEnvironment({
      "FOO": "outer-foo",
      "BAZ": "outer-baz",
      "QUUX": "outer-quux",
    });

    assertEquals(Deno.env.get("FOO"), "outer-foo");
    assertEquals(Deno.env.get("BAZ"), "outer-baz");
    assertEquals(Deno.env.get("QUUX"), "outer-quux");

    {
      using _innerEnv = simulateEnvironment({
        "FOO": "inner-foo",
        "BAZ": null,
        "EXTRA": "inner-extra",
      });

      assertEquals(Deno.env.get("FOO"), "inner-foo");
      assertEquals(Deno.env.get("BAZ"), undefined);
      assertEquals(Deno.env.get("QUUX"), "outer-quux");
      assertEquals(Deno.env.get("EXTRA"), "inner-extra");
    }

    assertEquals(Deno.env.get("FOO"), "outer-foo");
    assertEquals(Deno.env.get("BAZ"), "outer-baz");
    assertEquals(Deno.env.get("QUUX"), "outer-quux");
    assertEquals(Deno.env.get("EXTRA"), undefined);

    outerEnv.restore();

    assertEquals(Deno.env.get("FOO"), "bar");
    assertEquals(Deno.env.get("BAZ"), "qux");
    assertEquals(Deno.env.get("QUUX"), undefined);
    assertEquals(Deno.env.get("EXTRA"), undefined);
  });
});

describe("simulateBrowser", () => {
  it("should simulate browser globals with manual restore", async () => {
    const hydrationData: HydrationData = {
      matches: [],
      errors: null,
      loaderData: {},
    };
    const browser = await simulateBrowser(hydrationData);

    assertEquals(isBrowser(), true);
    assertEquals(isServer(), false);
    assertEquals(
      (globalThis as ClientGlobals).__juniperHydrationData,
      await serializeHydrationData(hydrationData),
    );

    browser.restore();

    assertEquals(isBrowser(), false);
    assertEquals(isServer(), true);
    assertEquals(
      (globalThis as ClientGlobals).__juniperHydrationData,
      undefined,
    );
  });

  it("should simulate browser globals with automatic restore using 'using'", async () => {
    const hydrationData: HydrationData = {
      matches: [],
      errors: null,
      loaderData: {},
    };
    {
      using _browser = await simulateBrowser(hydrationData);

      assertEquals(isBrowser(), true);
      assertEquals(isServer(), false);
      assertEquals(
        (globalThis as ClientGlobals).__juniperHydrationData,
        await serializeHydrationData(hydrationData),
      );
    }

    assertEquals(isBrowser(), false);
    assertEquals(isServer(), true);
    assertEquals(
      (globalThis as ClientGlobals).__juniperHydrationData,
      undefined,
    );
  });

  it("should throw error when trying to restore browser multiple times", async () => {
    const hydrationData: HydrationData = {
      matches: [],
      errors: null,
      loaderData: {},
    };
    const browser = await simulateBrowser(hydrationData);

    browser.restore();

    assertThrows(() => browser.restore(), Error, "Browser already restored");
  });

  it("should support nested simulated browsers", async () => {
    const outerHydrationData: HydrationData = {
      matches: [],
      errors: {
        "0": new Error("outer error"),
      },
      loaderData: {},
    };
    const outerBrowser = await simulateBrowser(outerHydrationData);

    assertEquals(isBrowser(), true);
    assertEquals(isServer(), false);
    assertEquals(
      (globalThis as ClientGlobals).__juniperHydrationData,
      await serializeHydrationData(outerHydrationData),
    );

    const innerHydrationData: HydrationData = {
      matches: [],
      errors: {
        "0": new Error("inner error"),
      },
      loaderData: {},
    };
    {
      using _innerBrowser = await simulateBrowser(innerHydrationData);

      assertEquals(isBrowser(), true);
      assertEquals(isServer(), false);
      assertEquals(
        (globalThis as ClientGlobals).__juniperHydrationData,
        await serializeHydrationData(innerHydrationData),
      );
    }

    assertEquals(isBrowser(), true);
    assertEquals(isServer(), false);
    assertEquals(
      (globalThis as ClientGlobals).__juniperHydrationData,
      await serializeHydrationData(outerHydrationData),
    );

    outerBrowser.restore();

    assertEquals(isBrowser(), false);
    assertEquals(isServer(), true);
    assertEquals(
      (globalThis as ClientGlobals).__juniperHydrationData,
      undefined,
    );
  });
});
