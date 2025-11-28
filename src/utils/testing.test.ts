import { assertEquals, assertThrows } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";

import {
  getEnv,
  isBrowser,
  isProduction,
  isServer,
  isTest,
} from "@udibo/juniper/utils/env";
import {
  simulateBrowser,
  simulateEnvironment,
} from "@udibo/juniper/utils/testing";

import type { HydrationData } from "../_client.tsx";
import { serializeHydrationData } from "../_server.tsx";
import { env } from "./_env.ts";

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
  const publicEnv = {
    APP_ENV: "test",
    APP_NAME: "Example",
    NODE_ENV: "development",
  };

  it("should simulate browser globals with manual restore", async () => {
    const hydrationData: HydrationData = {
      matches: [],
      errors: null,
      loaderData: {},
    };
    const browser = await simulateBrowser(hydrationData);

    assertEquals(isBrowser(), true);
    assertEquals(isServer(), false);
    assertEquals(getEnv("APP_ENV"), "test");
    assertEquals(getEnv("APP_NAME"), "Example");
    assertEquals(getEnv("NODE_ENV"), "development");
    assertEquals(
      env.getHydrationData(),
      await serializeHydrationData({
        ...hydrationData,
        publicEnv,
      }),
    );

    browser.restore();

    assertEquals(isBrowser(), false);
    assertEquals(isServer(), true);
    assertEquals(env.getHydrationData(), undefined);
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
        env.getHydrationData(),
        await serializeHydrationData({
          ...hydrationData,
          publicEnv,
        }),
      );
    }

    assertEquals(isBrowser(), false);
    assertEquals(isServer(), true);
    assertEquals(env.getHydrationData(), undefined);
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
      publicEnv: { APP_ENV: "production" },
      matches: [],
      errors: {
        "0": new Error("outer error"),
      },
      loaderData: {},
    };
    const outerBrowser = await simulateBrowser(outerHydrationData);

    assertEquals(isBrowser(), true);
    assertEquals(isServer(), false);
    assertEquals(isTest(), false);
    assertEquals(isProduction(), true);
    assertEquals(getEnv("APP_ENV"), "production");

    assertEquals(
      env.getHydrationData(),
      await serializeHydrationData({
        ...outerHydrationData,
        publicEnv: { ...publicEnv, ...outerHydrationData.publicEnv },
      }),
    );

    const innerHydrationData: HydrationData = {
      publicEnv: { APP_ENV: "test" },
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
      assertEquals(isTest(), true);
      assertEquals(isProduction(), false);
      assertEquals(
        env.getHydrationData(),
        await serializeHydrationData({
          ...innerHydrationData,
          publicEnv: { ...publicEnv, ...innerHydrationData.publicEnv },
        }),
      );
    }

    assertEquals(isBrowser(), true);
    assertEquals(isServer(), false);
    assertEquals(isTest(), false);
    assertEquals(isProduction(), true);
    assertEquals(
      env.getHydrationData(),
      await serializeHydrationData({
        ...outerHydrationData,
        publicEnv: { ...publicEnv, ...outerHydrationData.publicEnv },
      }),
    );

    outerBrowser.restore();

    assertEquals(isBrowser(), false);
    assertEquals(isServer(), true);
    assertEquals(isTest(), true);
    assertEquals(isProduction(), false);
    assertEquals(env.getHydrationData(), undefined);
  });

  it("should include default public env keys from Deno.env", async () => {
    const hydrationData: HydrationData = {
      matches: [],
    };
    using _browser = await simulateBrowser(hydrationData);

    assertEquals(getEnv("APP_ENV"), "test");
    assertEquals(getEnv("APP_NAME"), "Example");
    assertEquals(getEnv("NODE_ENV"), "development");
  });

  it("should allow overriding publicEnv via hydrationData", async () => {
    const hydrationData: HydrationData = {
      matches: [],
      publicEnv: { APP_ENV: "production", NODE_ENV: "production" },
    };
    using _browser = await simulateBrowser(hydrationData);

    assertEquals(getEnv("APP_ENV"), "production");
    assertEquals(getEnv("APP_NAME"), "Example");
    assertEquals(getEnv("NODE_ENV"), "production");
  });

  it("should include custom publicEnvKeys when specified", async () => {
    Deno.env.set("CUSTOM_VAR", "custom-value");
    Deno.env.set("OTHER_VAR", "other-value");

    const hydrationData: HydrationData = {
      matches: [],
    };
    using _browser = await simulateBrowser(hydrationData, {
      publicEnvKeys: ["CUSTOM_VAR"],
    });

    assertEquals(getEnv("APP_ENV"), "test");
    assertEquals(getEnv("CUSTOM_VAR"), "custom-value");
    assertEquals(getEnv("OTHER_VAR"), undefined);
  });
});
