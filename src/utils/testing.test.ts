import { assertEquals, assertRejects } from "@std/assert";
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

  it(
    "should simulate environment variables with callback",
    simulateEnvironment({
      "FOO": "foo",
      "BAZ": null,
      "QUUX": "quux",
    }, () => {
      assertEquals(Deno.env.get("FOO"), "foo");
      assertEquals(Deno.env.get("BAZ"), undefined);
      assertEquals(Deno.env.get("QUUX"), "quux");
      assertEquals(Deno.env.get("ABCD"), undefined);

      Deno.env.set("ABCD", "abcd");
      assertEquals(Deno.env.get("ABCD"), "abcd");
    }),
  );

  it("should restore environment after callback completes", () => {
    simulateEnvironment({
      "FOO": "foo",
      "BAZ": null,
      "QUUX": "quux",
    }, () => {
      assertEquals(Deno.env.get("FOO"), "foo");
    })();

    assertEquals(Deno.env.get("FOO"), "bar");
    assertEquals(Deno.env.get("BAZ"), "qux");
    assertEquals(Deno.env.get("QUUX"), undefined);
  });

  it("should restore environment after callback throws", () => {
    const wrapper = simulateEnvironment({
      "FOO": "foo",
    }, () => {
      throw new Error("Test error");
    });

    try {
      wrapper();
    } catch {
      // Expected
    }

    assertEquals(Deno.env.get("FOO"), "bar");
  });

  it(
    "should restore environment after async callback completes",
    async () => {
      await simulateEnvironment({
        "FOO": "foo",
        "BAZ": null,
        "QUUX": "quux",
      }, async () => {
        assertEquals(Deno.env.get("FOO"), "foo");
        await Promise.resolve();
      })();

      assertEquals(Deno.env.get("FOO"), "bar");
      assertEquals(Deno.env.get("BAZ"), "qux");
      assertEquals(Deno.env.get("QUUX"), undefined);
    },
  );

  it("should restore environment after async callback rejects", async () => {
    const wrapper = simulateEnvironment({
      "FOO": "foo",
    }, async () => {
      await Promise.resolve();
      throw new Error("Async test error");
    });

    await assertRejects(() => wrapper());

    assertEquals(Deno.env.get("FOO"), "bar");
  });

  it("should support nested simulated environments", () => {
    simulateEnvironment({
      "FOO": "outer-foo",
      "BAZ": "outer-baz",
      "QUUX": "outer-quux",
    }, () => {
      assertEquals(Deno.env.get("FOO"), "outer-foo");
      assertEquals(Deno.env.get("BAZ"), "outer-baz");
      assertEquals(Deno.env.get("QUUX"), "outer-quux");

      simulateEnvironment({
        "FOO": "inner-foo",
        "BAZ": null,
        "EXTRA": "inner-extra",
      }, () => {
        assertEquals(Deno.env.get("FOO"), "inner-foo");
        assertEquals(Deno.env.get("BAZ"), undefined);
        assertEquals(Deno.env.get("QUUX"), "outer-quux");
        assertEquals(Deno.env.get("EXTRA"), "inner-extra");
      })();

      assertEquals(Deno.env.get("FOO"), "outer-foo");
      assertEquals(Deno.env.get("BAZ"), "outer-baz");
      assertEquals(Deno.env.get("QUUX"), "outer-quux");
      assertEquals(Deno.env.get("EXTRA"), undefined);
    })();

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

  it(
    "should simulate browser globals with callback",
    simulateBrowser({
      matches: [],
      errors: null,
      loaderData: {},
    }, async () => {
      assertEquals(isBrowser(), true);
      assertEquals(isServer(), false);
      assertEquals(getEnv("APP_ENV"), "test");
      assertEquals(getEnv("APP_NAME"), "Example");
      assertEquals(getEnv("NODE_ENV"), "development");
      assertEquals(
        env.getHydrationData(),
        await serializeHydrationData({
          matches: [],
          errors: null,
          loaderData: {},
          publicEnv,
        }),
      );
    }),
  );

  it(
    "should simulate browser globals with callback only",
    simulateBrowser(async () => {
      assertEquals(isBrowser(), true);
      assertEquals(isServer(), false);
      assertEquals(getEnv("APP_ENV"), "test");
      assertEquals(getEnv("APP_NAME"), "Example");
      assertEquals(getEnv("NODE_ENV"), "development");
      assertEquals(
        env.getHydrationData(),
        await serializeHydrationData({
          matches: [],
          publicEnv,
        }),
      );
    }),
  );

  it(
    "should simulate browser globals with options and callback",
    simulateBrowser({ publicEnvKeys: ["CUSTOM_KEY"] }, async () => {
      assertEquals(isBrowser(), true);
      assertEquals(isServer(), false);
      assertEquals(getEnv("APP_ENV"), "test");
      assertEquals(
        env.getHydrationData(),
        await serializeHydrationData({
          matches: [],
          publicEnv,
        }),
      );
    }),
  );

  it("should restore browser globals after callback completes", async () => {
    const hydrationData: HydrationData = {
      matches: [],
      errors: null,
      loaderData: {},
    };
    await simulateBrowser(hydrationData, () => {
      assertEquals(isBrowser(), true);
      assertEquals(isServer(), false);
    })();

    assertEquals(isBrowser(), false);
    assertEquals(isServer(), true);
    assertEquals(env.getHydrationData(), undefined);
  });

  it("should restore browser globals after callback throws", async () => {
    const hydrationData: HydrationData = {
      matches: [],
      errors: null,
      loaderData: {},
    };
    const wrapper = simulateBrowser(hydrationData, () => {
      throw new Error("Test error");
    });

    await assertRejects(() => wrapper());

    assertEquals(isBrowser(), false);
    assertEquals(isServer(), true);
    assertEquals(env.getHydrationData(), undefined);
  });

  it(
    "should restore browser globals after async callback rejects",
    async () => {
      const hydrationData: HydrationData = {
        matches: [],
        errors: null,
        loaderData: {},
      };
      const wrapper = simulateBrowser(hydrationData, async () => {
        await Promise.resolve();
        throw new Error("Async test error");
      });

      await assertRejects(() => wrapper());

      assertEquals(isBrowser(), false);
      assertEquals(isServer(), true);
      assertEquals(env.getHydrationData(), undefined);
    },
  );

  it("should support nested simulated browsers", async () => {
    const outerHydrationData: HydrationData = {
      publicEnv: { APP_ENV: "production" },
      matches: [],
      errors: {
        "0": new Error("outer error"),
      },
      loaderData: {},
    };

    await simulateBrowser(outerHydrationData, async () => {
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

      await simulateBrowser(innerHydrationData, async () => {
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
      })();

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
    })();

    assertEquals(isBrowser(), false);
    assertEquals(isServer(), true);
    assertEquals(isTest(), true);
    assertEquals(isProduction(), false);
    assertEquals(env.getHydrationData(), undefined);
  });

  it(
    "should include default public env keys from Deno.env",
    simulateBrowser({
      matches: [],
    }, () => {
      assertEquals(getEnv("APP_ENV"), "test");
      assertEquals(getEnv("APP_NAME"), "Example");
      assertEquals(getEnv("NODE_ENV"), "development");
    }),
  );

  it(
    "should allow overriding publicEnv via hydrationData",
    simulateBrowser({
      matches: [],
      publicEnv: { APP_ENV: "production", NODE_ENV: "production" },
    }, () => {
      assertEquals(getEnv("APP_ENV"), "production");
      assertEquals(getEnv("APP_NAME"), "Example");
      assertEquals(getEnv("NODE_ENV"), "production");
    }),
  );

  it("should include custom publicEnvKeys when specified", async () => {
    Deno.env.set("CUSTOM_VAR", "custom-value");
    Deno.env.set("OTHER_VAR", "other-value");

    await simulateBrowser(
      { matches: [] },
      { publicEnvKeys: ["CUSTOM_VAR"] },
      () => {
        assertEquals(getEnv("APP_ENV"), "test");
        assertEquals(getEnv("CUSTOM_VAR"), "custom-value");
        assertEquals(getEnv("OTHER_VAR"), undefined);
      },
    )();
  });
});
