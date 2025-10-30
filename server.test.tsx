import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { Client } from "@udibo/juniper/client";
import { createServer } from "@udibo/juniper/server";
import { simulateEnvironment } from "@udibo/juniper/utils/testing";
import { HttpError } from "@udibo/http-error";

import { serializeErrorDefault } from "./_server.tsx";

describe("createServer", () => {
  it("should return 404 for a non-existent route", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => null },
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
    });
    const res = await server.request("http://localhost/non-existent-route");
    assertEquals(res.status, 404);
  });

  it("should convert client routes to server routes with HTML response", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => null },
      children: [
        {
          path: "about",
          main: () => Promise.resolve({ default: () => null }),
        },
        {
          path: "contact",
          index: () => Promise.resolve({ default: () => null }),
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
    });

    const aboutRes = await server.request("http://localhost/about");
    assertEquals(aboutRes.status, 200);
    assertEquals(
      aboutRes.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    const aboutText = await aboutRes.text();
    assertStringIncludes(aboutText, "<!DOCTYPE html>");

    const contactRes = await server.request("http://localhost/contact");
    assertEquals(contactRes.status, 200);
    assertEquals(
      contactRes.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    const contactText = await contactRes.text();
    assertStringIncludes(contactText, "<!DOCTYPE html>");
  });

  it("should give priority to server routes over client routes", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => null },
      children: [
        {
          path: "test",
          main: () => Promise.resolve({ default: () => null }),
        },
      ],
    });

    const testApp = new (await import("hono")).Hono();
    testApp.get("/", (c) => c.text("Server Route"));

    const server = createServer(import.meta.url, client, {
      path: "/",
      children: [
        {
          path: "test",
          main: { default: testApp },
        },
      ],
    });

    // Server route should take priority and return plain text, not HTML
    const testRes = await server.request("http://localhost/test");
    assertEquals(testRes.status, 200);
    assertEquals(await testRes.text(), "Server Route");
  });
});

describe("serializeErrorDefault", () => {
  it("should pass through non-Error values unchanged", () => {
    const value = { foo: "bar" };
    const result = serializeErrorDefault(value);
    assertEquals(result, value);
  });

  it("should serialize generic Error with message and stack in development", () => {
    using _env = simulateEnvironment({ "APP_ENV": null });
    const err = new Error("Oops");
    const result = serializeErrorDefault(err) as Record<string, unknown>;
    assertEquals(result.__type, "Error");
    assertEquals(result.message, "Oops");
    assertEquals(typeof result.stack, "string");
    assertEquals(result.__subType, undefined);
  });

  it("should omit stack outside development", () => {
    using _env = simulateEnvironment({ "APP_ENV": "production" });
    const err = new Error("No stack");
    const result = serializeErrorDefault(err) as Record<string, unknown>;
    assertEquals(result.__type, "Error");
    assertEquals(result.message, "No stack");
    assertEquals(result.stack, undefined);
  });

  it("should set __subType for Error subclasses", () => {
    const err = new TypeError("Wrong type");
    const result = serializeErrorDefault(err) as Record<string, unknown>;
    assertEquals(result.__type, "Error");
    assertEquals(result.__subType, "TypeError");
    assertEquals(result.message, "Wrong type");
  });

  it("should serialize HttpError with RFC7807 fields", () => {
    const err = new HttpError(400, "Bad request");
    const result = serializeErrorDefault(err) as Record<string, unknown>;
    assertEquals(result.__type, "Error");
    assertEquals(result.__subType, "HttpError");
    assertEquals(result.status, 400);
    const detailOrMessage = (result as Record<string, unknown>)["detail"] ??
      result.message;
    assertEquals(detailOrMessage, "Bad request");
  });
});
