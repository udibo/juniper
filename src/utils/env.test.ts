import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";

import {
  getEnv,
  isBrowser,
  isDevelopment,
  isProduction,
  isServer,
  isTest,
} from "./env.ts";
import { simulateEnvironment } from "./testing.ts";

import { simulateBrowser } from "./testing.internal.ts";

import { env } from "./_env.ts";

const clientEnv = {
  "APP_ENV": "production",
  "APP_NAME": "TestApp",
  "NODE_ENV": "production",
  "PUBLIC_VAR": "public-value",
  "SECRET_VAR": "secret-value",
};

describe("Environment Utilities", () => {
  describe("getEnv", () => {
    describe("on server", () => {
      it(
        "should return the value from Deno.env",
        simulateEnvironment({ "MY_VAR": "my-value" }, () => {
          assertEquals(getEnv("MY_VAR"), "my-value");
        }),
      );

      it(
        "should return undefined for unset variables",
        simulateEnvironment({ "MY_VAR": null }, () => {
          assertEquals(getEnv("MY_VAR"), undefined);
        }),
      );
    });

    describe("on client", () => {
      it(
        "should only expose public environment variables",
        simulateEnvironment(
          clientEnv,
          simulateBrowser({ matches: [] }, () => {
            assertEquals(getEnv("APP_ENV"), "production");
            assertEquals(getEnv("APP_NAME"), "TestApp");
            assertEquals(getEnv("NODE_ENV"), "production");
            assertEquals(getEnv("PUBLIC_VAR"), undefined);
            assertEquals(getEnv("SECRET_VAR"), undefined);
          }),
        ),
      );

      it(
        "should include custom publicEnvKeys when specified",
        simulateEnvironment(
          clientEnv,
          simulateBrowser(
            { matches: [] },
            { publicEnvKeys: ["PUBLIC_VAR"] },
            () => {
              assertEquals(getEnv("APP_ENV"), "production");
              assertEquals(getEnv("PUBLIC_VAR"), "public-value");
              assertEquals(getEnv("SECRET_VAR"), undefined);
            },
          ),
        ),
      );

      it(
        "should allow overriding publicEnv via hydrationData",
        simulateEnvironment(
          clientEnv,
          simulateBrowser(
            {
              matches: [],
              publicEnv: { APP_ENV: "staging", CUSTOM_KEY: "custom-value" },
            },
            { publicEnvKeys: ["PUBLIC_VAR"] },
            () => {
              assertEquals(getEnv("APP_ENV"), "staging");
              assertEquals(getEnv("PUBLIC_VAR"), "public-value");
              assertEquals(getEnv("CUSTOM_KEY"), "custom-value");
            },
          ),
        ),
      );
    });
  });

  describe("isDevelopment", () => {
    it(
      "should return true when APP_ENV is 'development'",
      simulateEnvironment({ "APP_ENV": "development" }, () => {
        assertEquals(isDevelopment(), true);
      }),
    );

    it(
      "should return true when APP_ENV is not set",
      simulateEnvironment({ "APP_ENV": null }, () => {
        assertEquals(isDevelopment(), true);
      }),
    );

    it(
      "should return false when APP_ENV is 'production'",
      simulateEnvironment({ "APP_ENV": "production" }, () => {
        assertEquals(isDevelopment(), false);
      }),
    );

    it(
      "should return false when APP_ENV is 'test'",
      simulateEnvironment({ "APP_ENV": "test" }, () => {
        assertEquals(isDevelopment(), false);
      }),
    );

    it(
      "should return false when APP_ENV is an unknown value",
      simulateEnvironment({ "APP_ENV": "staging" }, () => {
        assertEquals(isDevelopment(), false);
      }),
    );
  });

  describe("isProduction", () => {
    it(
      "should return true when APP_ENV is 'production'",
      simulateEnvironment({ "APP_ENV": "production" }, () => {
        assertEquals(isProduction(), true);
      }),
    );

    it(
      "should return false when APP_ENV is 'development'",
      simulateEnvironment({ "APP_ENV": "development" }, () => {
        assertEquals(isProduction(), false);
      }),
    );

    it(
      "should return false when APP_ENV is not set",
      simulateEnvironment({ "APP_ENV": null }, () => {
        assertEquals(isProduction(), false);
      }),
    );

    it(
      "should return false when APP_ENV is 'test'",
      simulateEnvironment({ "APP_ENV": "test" }, () => {
        assertEquals(isProduction(), false);
      }),
    );

    it(
      "should return false when APP_ENV is an unknown value",
      simulateEnvironment({ "APP_ENV": "staging" }, () => {
        assertEquals(isProduction(), false);
      }),
    );
  });

  describe("isTest", () => {
    it(
      "should return true when APP_ENV is 'test'",
      simulateEnvironment({ "APP_ENV": "test" }, () => {
        assertEquals(isTest(), true);
      }),
    );

    it(
      "should return false when APP_ENV is 'development'",
      simulateEnvironment({ "APP_ENV": "development" }, () => {
        assertEquals(isTest(), false);
      }),
    );

    it(
      "should return false when APP_ENV is not set",
      simulateEnvironment({ "APP_ENV": null }, () => {
        assertEquals(isTest(), false);
      }),
    );

    it(
      "should return false when APP_ENV is 'production'",
      simulateEnvironment({ "APP_ENV": "production" }, () => {
        assertEquals(isTest(), false);
      }),
    );

    it(
      "should return false when APP_ENV is an unknown value",
      simulateEnvironment({ "APP_ENV": "staging" }, () => {
        assertEquals(isTest(), false);
      }),
    );
  });

  describe("isServer", () => {
    it("should return true", () => {
      assertEquals(isServer(), true);
    });

    it("should return false when env.isServer returns false", () => {
      using _isServerStub = stub(env, "isServer", () => false);
      assertEquals(isServer(), false);
    });
  });

  describe("internal env", () => {
    it("env.isServer returns true in Deno runtime", () => {
      assertEquals(env.isServer(), true);
    });
  });

  describe("isBrowser", () => {
    it("should return true when env.isServer returns false", () => {
      using _isServerStub = stub(env, "isServer", () => false);
      assertEquals(isBrowser(), true);
    });

    it("should return false when env.isServer returns true", () => {
      using _isServerStub = stub(env, "isServer", () => true);
      assertEquals(isBrowser(), false);
    });
  });
});
