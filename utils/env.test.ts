import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { isDevelopment, isProduction, isTest } from "./env.ts";
import { simulateEnvironment } from "./testing.ts";

describe("Environment Utilities", () => {
  describe("isDevelopment", () => {
    it("should return true when APP_ENV is 'development'", () => {
      using _env = simulateEnvironment({ "APP_ENV": "development" });
      assertEquals(isDevelopment(), true);
    });

    it("should return true when APP_ENV is not set", () => {
      using _env = simulateEnvironment({ "APP_ENV": null });
      assertEquals(isDevelopment(), true);
    });

    it("should return false when APP_ENV is 'production'", () => {
      using _env = simulateEnvironment({ "APP_ENV": "production" });
      assertEquals(isDevelopment(), false);
    });

    it("should return false when APP_ENV is 'test'", () => {
      using _env = simulateEnvironment({ "APP_ENV": "test" });
      assertEquals(isDevelopment(), false);
    });

    it("should return false when APP_ENV is an unknown value", () => {
      using _env = simulateEnvironment({ "APP_ENV": "staging" });
      assertEquals(isDevelopment(), false);
    });
  });

  describe("isProduction", () => {
    it("should return true when APP_ENV is 'production'", () => {
      using _env = simulateEnvironment({ "APP_ENV": "production" });
      assertEquals(isProduction(), true);
    });

    it("should return false when APP_ENV is 'development'", () => {
      using _env = simulateEnvironment({ "APP_ENV": "development" });
      assertEquals(isProduction(), false);
    });

    it("should return false when APP_ENV is not set", () => {
      using _env = simulateEnvironment({ "APP_ENV": null });
      assertEquals(isProduction(), false);
    });

    it("should return false when APP_ENV is 'test'", () => {
      using _env = simulateEnvironment({ "APP_ENV": "test" });
      assertEquals(isProduction(), false);
    });

    it("should return false when APP_ENV is an unknown value", () => {
      using _env = simulateEnvironment({ "APP_ENV": "staging" });
      assertEquals(isProduction(), false);
    });
  });

  describe("isTest", () => {
    it("should return true when APP_ENV is 'test'", () => {
      using _env = simulateEnvironment({ "APP_ENV": "test" });
      assertEquals(isTest(), true);
    });

    it("should return false when APP_ENV is 'development'", () => {
      using _env = simulateEnvironment({ "APP_ENV": "development" });
      assertEquals(isTest(), false);
    });

    it("should return false when APP_ENV is not set", () => {
      using _env = simulateEnvironment({ "APP_ENV": null });
      assertEquals(isTest(), false);
    });

    it("should return false when APP_ENV is 'production'", () => {
      using _env = simulateEnvironment({ "APP_ENV": "production" });
      assertEquals(isTest(), false);
    });

    it("should return false when APP_ENV is an unknown value", () => {
      using _env = simulateEnvironment({ "APP_ENV": "staging" });
      assertEquals(isTest(), false);
    });
  });
});
