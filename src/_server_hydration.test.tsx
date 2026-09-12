import {
  assert,
  assertEquals,
  assertExists,
  assertFalse,
  assertInstanceOf,
  assertRejects,
} from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { createContext } from "react-router";
import { Client } from "@udibo/juniper/client";
import { HttpError, registerContext, registerType } from "@udibo/juniper";
import { createServer } from "@udibo/juniper/server";
import { simulateEnvironment } from "@udibo/juniper/utils/testing";
import {
  deserializeError,
  deserializeHydrationData,
  deserializeStreamingLoaderData,
  fromTaggedJson,
  resetRegistries,
  type SerializedHydrationData,
  serializeHydrationData,
} from "./_serialization.ts";

const HYDRATION_ASSIGNMENT =
  /window\.__juniperHydrationData = (.*?); await client\.hydrate\(\);/;
const hostile =
  "</script><script>globalThis.pwned=1</script><!--<script></SCRIPT >\u2028\u2029";

function serverWithLoaderData(loaderData: unknown) {
  const client = new Client({
    path: "/",
    main: { default: () => <div>Home</div> },
  });
  return createServer(import.meta.url, client, {
    path: "/",
    main: { loader: () => loaderData, action: () => loaderData },
  });
}

function scriptBodyContaining(html: string, marker: string): string {
  const markerAt = html.indexOf(marker);
  assert(markerAt >= 0, `the document carries no ${marker}`);
  const bodyStart = html.lastIndexOf(">", markerAt) + 1;
  const bodyEnd = html.toLowerCase().indexOf("</script", bodyStart);
  return html.slice(bodyStart, bodyEnd);
}

function assertEscapedDocument(html: string): SerializedHydrationData {
  const body = scriptBodyContaining(html, "window.__juniperHydrationData");
  assert(body.startsWith('import { client } from "/build/main.js";'));
  assert(
    body.endsWith("; await client.hydrate();"),
    "the first closing script belongs to Juniper",
  );
  assertFalse(body.includes("<"));
  assertFalse(body.includes("\u2028"));
  assertFalse(body.includes("\u2029"));
  assertFalse(html.includes(hostile));
  const payload = HYDRATION_ASSIGNMENT.exec(body)?.[1];
  assertExists(payload);
  const serialized = JSON.parse(payload) as SerializedHydrationData;
  assertEquals(serialized.version, 3);
  return serialized;
}

describe("the document's hydration payload", () => {
  beforeEach(resetRegistries);
  afterEach(resetRegistries);

  it("keeps hostile loader text and keys inside the hydration script", async () => {
    const data = { [hostile]: [{ text: hostile, $t: "Date", v: 5 }] };
    const html =
      await (await serverWithLoaderData(data).request("http://localhost/"))
        .text();
    assertEquals(
      deserializeHydrationData(assertEscapedDocument(html)).loaderData?.["/"],
      data,
    );
  });

  it(
    "escapes context, public environment and errors in rendered HTML",
    simulateEnvironment(
      { APP_ENV: "test", PUBLIC_HOSTILE: hostile },
      async () => {
        const context = createContext({ [hostile]: hostile });
        registerContext({
          name: "hostile",
          context,
          serialize: (v) => v,
          deserialize: (v) => v!,
        });
        const client = new Client({
          path: "/",
          main: {
            default: () => <div>Home</div>,
            ErrorBoundary: () => <div>Failed</div>,
          },
        });
        const server = createServer(import.meta.url, client, {
          path: "/",
          main: {
            publicEnvKeys: ["PUBLIC_HOSTILE"],
            loader: () => {
              throw new HttpError(400, {
                message: "private",
                exposedMessage: hostile,
              });
            },
          },
        });
        using _log = stub(console, "error");
        const html = await (await server.request("http://localhost/")).text();
        const hydration = deserializeHydrationData(assertEscapedDocument(html));
        assertEquals(hydration.serializedContext, {
          hostile: { [hostile]: hostile },
        });
        assertEquals(hydration.publicEnv?.PUBLIC_HOSTILE, hostile);
        const error = hydration.errors?.["/"];
        assertInstanceOf(error, HttpError);
        assertEquals(error.message, hostile);
      },
    ),
  );

  it(
    "carries sorted development registrations and logs names missing on the client",
    simulateEnvironment({ APP_ENV: "development" }, async () => {
      class Zulu {}
      class Alpha {}
      registerType({
        name: "Zulu",
        is: (v): v is Zulu => v instanceof Zulu,
        serialize: () => 1,
        deserialize: () => new Zulu(),
      });
      registerType({
        name: "Alpha",
        is: (v): v is Alpha => v instanceof Alpha,
        serialize: () => 2,
        deserialize: () => new Alpha(),
      });
      const html = await (await serverWithLoaderData({ ok: true }).request(
        "http://localhost/",
      )).text();
      const serialized = assertEscapedDocument(html);
      const names =
        (fromTaggedJson(serialized.data) as { registeredNames: string[] })
          .registeredNames;
      assertEquals(names, [...names].sort());
      assert(names.includes("type:Zulu") && names.includes("type:Alpha"));
      resetRegistries();
      using logged = stub(console, "error");
      deserializeHydrationData(serialized);
      assertEquals(logged.calls.map((call) => call.args[0]), [
        "Missing Juniper registrations: type:Alpha, type:Zulu",
      ]);
    }),
  );

  it(
    "omits registration diagnostics in production",
    simulateEnvironment({ APP_ENV: "production" }, async () => {
      const serialized = await serializeHydrationData({ matches: [] });
      assertFalse(
        Object.hasOwn(
          fromTaggedJson(serialized.data) as object,
          "registeredNames",
        ),
      );
    }),
  );
});

describe("tagged JSON data requests", () => {
  it("aborts the response stream with the incoming request", async () => {
    const controller = new AbortController();
    const later = Promise.withResolvers<number>();
    const response = await serverWithLoaderData({ later: later.promise })
      .request("http://localhost/", {
        signal: controller.signal,
        headers: { "X-Juniper-Route-Id": "/" },
      });
    const reader = response.body!.getReader();
    await reader.read();
    const waiting = reader.read();
    controller.abort(new Error("request canceled"));
    await assertRejects(() => waiting, Error, "request canceled");
    later.resolve(1);
    reader.releaseLock();
  });

  for (const method of ["GET", "POST"]) {
    it(`answers settled ${method} data with JSON, a marker and UTF-8 byte length`, async () => {
      const server = serverWithLoaderData({
        at: new Date(0),
        missing: undefined,
        text: "水🌿",
      });
      const response = await server.request("http://localhost/", {
        method,
        headers: { "X-Juniper-Route-Id": "/" },
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      assertEquals(response.headers.get("Content-Type"), "application/json");
      assertEquals(response.headers.get("X-Juniper"), "data");
      assertEquals(
        response.headers.get("Content-Length"),
        String(bytes.length),
      );
      const data = await deserializeStreamingLoaderData<
        Record<string, unknown>
      >(new Response(bytes));
      assertEquals(data, { at: new Date(0), missing: undefined, text: "水🌿" });
    });
    it(`streams deferred ${method} data as progressive NDJSON without origin compression`, async () => {
      const first = Promise.withResolvers<number>();
      const second = Promise.withResolvers<number>();
      const server = serverWithLoaderData({
        first: first.promise,
        second: second.promise,
      });
      const response = await server.request("http://localhost/", {
        method,
        headers: { "X-Juniper-Route-Id": "/", "Accept-Encoding": "br, gzip" },
      });
      assertEquals(
        response.headers.get("Content-Type"),
        "application/x-ndjson",
      );
      assertEquals(response.headers.get("X-Juniper"), "data");
      assertEquals(response.headers.get("Cache-Control"), "no-transform");
      assertEquals(response.headers.get("Content-Encoding"), null);
      assertEquals(response.headers.get("Content-Length"), null);
      const reader = response.body!.pipeThrough(new TextDecoderStream())
        .getReader();
      const initial = await reader.read();
      assertEquals(JSON.parse(initial.value!), {
        first: { $t: "pending", v: "p0" },
        second: { $t: "pending", v: "p1" },
      });
      second.resolve(2);
      assertEquals(JSON.parse((await reader.read()).value!), {
        id: "p1",
        status: "resolved",
        value: 2,
      });
      first.resolve(1);
      assertEquals(JSON.parse((await reader.read()).value!), {
        id: "p0",
        status: "resolved",
        value: 1,
      });
      assert((await reader.read()).done);
      reader.releaseLock();
    });
  }

  it("uses the same JSON envelope for data errors and preserves exposedMessage", async () => {
    const client = new Client({ path: "/", main: { default: () => <div /> } });
    const server = createServer(import.meta.url, client, {
      path: "/",
      main: {
        loader: () => {
          throw new HttpError(500, {
            message: "private database detail",
            exposedMessage: "Try again",
          });
        },
      },
    });
    using _log = stub(console, "error");
    const response = await server.request("http://localhost/", {
      headers: { "X-Juniper-Route-Id": "/" },
    });
    assertEquals(response.status, 500);
    assertEquals(response.headers.get("Content-Type"), "application/json");
    assertEquals(response.headers.get("X-Juniper"), "data");
    const text = await response.text();
    assertFalse(text.includes("private database detail"));
    assertEquals(
      response.headers.get("Content-Length"),
      String(new TextEncoder().encode(text).length),
    );
    const data = await deserializeStreamingLoaderData<Record<string, unknown>>(
      new Response(text),
    );
    assertEquals(data.__errorType, "HttpError");
    const error = deserializeError(data);
    assertInstanceOf(error, HttpError);
    assertEquals(error.exposedMessage, "Try again");
  });

  it(
    "sanitizes streamed server errors and preserves explicit exposed messages",
    simulateEnvironment({ APP_ENV: "production" }, async () => {
      const data = {
        private: Promise.reject(new Error("private database detail")),
        exposed: Promise.reject(
          new HttpError(403, {
            message: "private lookup",
            exposedMessage: "Not permitted",
          }),
        ),
      };
      const response = await serverWithLoaderData(data).request(
        "http://localhost/",
        { headers: { "X-Juniper-Route-Id": "/" } },
      );
      const text = await response.text();
      assertFalse(text.includes("private database detail"));
      assertFalse(text.includes("private lookup"));
      const restored = await deserializeStreamingLoaderData<typeof data>(
        new Response(text),
      );
      await assertRejects(
        () => restored.private,
        HttpError,
        new HttpError(500).exposedMessage,
      );
      await assertRejects(() => restored.exposed, HttpError, "Not permitted");
    }),
  );
});
