import "./utils/global-jsdom.ts";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
import { Client } from "@udibo/juniper/client";
import { HttpError } from "@udibo/juniper";
import { createRoute } from "./_client.tsx";
import {
  createLoaderDataResponse,
  prepareHydrationData,
  serializeError,
} from "./_serialization.ts";
import type { SerializedHydrationData } from "./_serialization.ts";
import { env } from "./utils/_env.ts";

describe("client tagged JSON data dispatch", () => {
  for (const method of ["GET", "POST"]) {
    it(`decodes settled and deferred ${method} data and the same error envelope`, async () => {
      const route = createRoute({}, { loader: true, action: true }, "/wire");
      const handler = method === "GET" ? route.loader : route.action;
      assertExists(handler);
      const args = () => ({
        context: {} as never,
        params: {},
        request: new Request("http://localhost/wire", {
          method,
          ...(method === "POST" ? { body: new FormData() } : {}),
        }),
        url: new URL("http://localhost/wire"),
        pattern: "/wire",
      });
      for (const deferred of [false, true]) {
        const value = { at: new Date(5), missing: undefined, $t: "Date" };
        using _fetch = stub(
          globalThis,
          "fetch",
          () =>
            Promise.resolve(
              createLoaderDataResponse({
                value: deferred ? Promise.resolve(value) : value,
              }),
            ),
        );
        const result = await handler(args()) as { value: unknown };
        assertEquals(await result.value, value);
      }
      using _fetch = stub(globalThis, "fetch", () => {
        const encoded = createLoaderDataResponse(
          serializeError(new HttpError(403, "Denied")),
        );
        return Promise.resolve(
          new Response(encoded.body, { status: 403, headers: encoded.headers }),
        );
      });
      await assertRejects(
        async () => await handler(args()),
        HttpError,
        "Denied",
      );
    });
  }

  it("leaves JSON API responses without the data marker as Responses", async () => {
    const response = Response.json({ $t: "Date", v: 5 });
    using _fetch = stub(globalThis, "fetch", () => Promise.resolve(response));
    const route = createRoute({}, { loader: true }, "/wire");
    assertExists(route.loader);
    const result = await route.loader({
      context: {} as never,
      params: {},
      request: new Request("http://localhost/wire"),
      url: new URL("http://localhost/wire"),
      pattern: "/wire",
    });
    assertEquals(result, response);
    assertEquals(response.bodyUsed, false);
    await response.body?.cancel();
  });
});

describe("hydration version recovery", () => {
  const key = "__juniper_build_skew_reload";
  let originalLocation: Location;
  let reloads: number;
  beforeEach(() => {
    reloads = 0;
    originalLocation = globalThis.location;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        href: "http://localhost/",
        reload: () => {
          reloads++;
        },
      },
    });
    sessionStorage.removeItem(key);
  });
  afterEach(() => {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: originalLocation,
    });
    sessionStorage.removeItem(key);
  });

  for (const version of [2, 5, 0]) {
    it(`reloads version ${version} before reading its data and coalesces concurrent attempts`, async () => {
      using time = new FakeTime();
      let decoded = 0;
      let loaded = 0;
      using _data = stub(env, "getHydrationData", () => ({
        version,
        get data() {
          decoded++;
          throw new Error("must not decode");
        },
      } as unknown as SerializedHydrationData));
      const client = new Client({ path: "/" });
      using _routes = stub(client, "loadLazyMatches", () => {
        loaded++;
        return Promise.resolve();
      });
      const outcomes: unknown[] = [];
      for (let i = 0; i < 3; i++) {
        client.hydrate().then(
          () => outcomes.push("resolved"),
          (e) => outcomes.push(e),
        );
      }
      await time.tickAsync(1);
      assertEquals(decoded, 0);
      assertEquals(loaded, 0);
      assertEquals(reloads, 1);
      assertEquals(outcomes, []);
      assertEquals(JSON.parse(sessionStorage.getItem(key)!).count, 1);
    });
  }

  it("hydrates a version 4 payload with pending placeholders instead of reloading", async () => {
    using time = new FakeTime();
    const { serialized } = prepareHydrationData({
      matches: [{ id: "/" }],
      loaderData: { "/": { later: Promise.resolve(1) } },
    });
    assertEquals(serialized.version, 4);
    let loaded = 0;
    using _data = stub(env, "getHydrationData", () => serialized);
    using _queue = stub(env, "getDeferredHydration", () => []);
    using _parsed = stub(env, "whenDocumentParsed", () => {});
    const client = new Client({ path: "/" });
    using _routes = stub(client, "loadLazyMatches", () => {
      loaded++;
      return new Promise<void>(() => {});
    });
    client.hydrate();
    await time.tickAsync(1);
    assertEquals(reloads, 0);
    assertEquals(loaded, 1);
    assertEquals(sessionStorage.getItem(key), null);
  });

  it("surfaces an unsupported version after the guarded reload budget is exhausted", async () => {
    sessionStorage.setItem(
      key,
      JSON.stringify({ count: 2, timestamp: Date.now() }),
    );
    using _data = stub(
      env,
      "getHydrationData",
      () => ({
        version: 2,
        data: "obsolete",
      } as unknown as SerializedHydrationData),
    );
    await assertRejects(
      () => new Client({ path: "/" }).hydrate(),
      Error,
      "Unsupported hydration data version: 2",
    );
    assertEquals(reloads, 0);
  });

  it("surfaces missing type registrations during hydration", async () => {
    using _data = stub(
      env,
      "getHydrationData",
      () => ({
        version: 3 as const,
        data: {
          matches: [],
          loaderData: {
            root: { $t: "type", v: { __type: "Absent", data: 1 } },
          },
        },
      }),
    );
    await assertRejects(
      () => new Client({ path: "/" }).hydrate(),
      Error,
      "No deserializer registered for type",
    );
    assertEquals(reloads, 0);
  });
});
