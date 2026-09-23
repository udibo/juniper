import {
  assert,
  assertEquals,
  assertExists,
  assertFalse,
  assertInstanceOf,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { delay } from "@std/async/delay";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
import { Suspense } from "react";
import { Await, createContext, redirect } from "react-router";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { NONCE, secureHeaders } from "hono/secure-headers";
import { Client } from "@udibo/juniper/client";
import {
  HttpError,
  registerContext,
  registerError,
  registerType,
} from "@udibo/juniper";
import type { AnyParams, RouteProps } from "@udibo/juniper";
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
import { toRedirectEnvelope } from "./_server.tsx";
import { env } from "./utils/_env.ts";

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

function assertEscapedDocument(
  html: string,
  version: SerializedHydrationData["version"] = 3,
): SerializedHydrationData {
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
  assertEquals(serialized.version, version);
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
      class Domain extends Error {}
      registerError({
        name: "Domain",
        is: (value): value is Domain => value instanceof Domain,
        serialize: () => ({}),
        deserialize: () => new Domain(),
      });
      registerContext({
        name: "Shared",
        context: createContext(0),
        serialize: (value) => value,
        deserialize: (value) => value ?? 0,
      });
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
      assert(
        names.includes("error:Domain") && names.includes("context:Shared"),
      );
      resetRegistries();
      using logged = stub(console, "error");
      deserializeHydrationData(serialized);
      assertEquals(logged.calls.map((call) => call.args[0]), [
        "Missing Juniper registrations: context:Shared, error:Domain, type:Alpha, type:Zulu",
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
      assertEquals(
        response.headers.get("Cache-Control"),
        "private, no-cache, no-transform",
      );
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

describe("the cache policy of data responses", () => {
  function serverWithRouteData(
    load: () => unknown,
    ...middleware: MiddlewareHandler[]
  ) {
    const client = new Client({
      path: "/",
      main: { default: () => <div>Home</div> },
    });
    return createServer(import.meta.url, client, {
      path: "/",
      main: {
        ...(middleware.length
          ? { default: new Hono().use(...middleware) }
          : {}),
        loader: load,
        action: load,
      },
    });
  }

  async function dataCacheControl(
    server: ReturnType<typeof serverWithRouteData>,
    method = "GET",
  ): Promise<string | null> {
    const response = await server.request("http://localhost/", {
      method,
      headers: { "X-Juniper-Route-Id": "/" },
    });
    await response.arrayBuffer();
    assertEquals(response.headers.get("X-Juniper"), "data");
    return response.headers.get("Cache-Control");
  }

  const setBeforeNext =
    (policy: string): MiddlewareHandler => async (c, next) => {
      c.header("Cache-Control", policy);
      await next();
    };

  for (const method of ["GET", "POST"]) {
    it(`keeps streamed ${method} data out of shared caches, revalidated on every use and untransformed`, async () => {
      const server = serverWithRouteData(() => ({ later: Promise.resolve(1) }));
      assertEquals(
        await dataCacheControl(server, method),
        "private, no-cache, no-transform",
      );
    });

    it(`keeps settled ${method} data out of shared caches and revalidated on every use`, async () => {
      const server = serverWithRouteData(() => ({ now: 1 }));
      assertEquals(await dataCacheControl(server, method), "private, no-cache");
    });
  }

  it("keeps a data error out of shared caches and revalidated on every use", async () => {
    using _log = stub(console, "error");
    const server = serverWithRouteData(() => {
      throw new HttpError(404, "Missing");
    });
    assertEquals(await dataCacheControl(server), "private, no-cache");
  });

  it("uses the policy app middleware sets before next() for settled data", async () => {
    const server = serverWithRouteData(
      () => ({ now: 1 }),
      setBeforeNext("public, max-age=60"),
    );
    assertEquals(await dataCacheControl(server), "public, max-age=60");
  });

  it("adds no-transform to the policy app middleware sets before next() for streamed data", async () => {
    const server = serverWithRouteData(
      () => ({ later: Promise.resolve(1) }),
      setBeforeNext("public, max-age=60"),
    );
    assertEquals(
      await dataCacheControl(server),
      "public, max-age=60, no-transform",
    );
  });

  it("does not repeat a no-transform directive the app's policy already has, in any case", async () => {
    const server = serverWithRouteData(
      () => ({ later: Promise.resolve(1) }),
      setBeforeNext("public, No-Transform, max-age=60"),
    );
    assertEquals(
      await dataCacheControl(server),
      "public, No-Transform, max-age=60",
    );
  });

  it("sends the policy app middleware sets after next() unchanged", async () => {
    const server = serverWithRouteData(
      () => ({ later: Promise.resolve(1) }),
      async (c, next) => {
        await next();
        c.header("Cache-Control", "no-store");
      },
    );
    assertEquals(await dataCacheControl(server), "no-store");
  });

  it("uses the policy app middleware sets before next() for a data error", async () => {
    using _log = stub(console, "error");
    const server = serverWithRouteData(
      () => {
        throw new HttpError(404, "Missing");
      },
      setBeforeNext("public, max-age=60"),
    );
    assertEquals(await dataCacheControl(server), "public, max-age=60");
  });

  it("prefers the policy a thrown error carries over the app's and the default", async () => {
    using _log = stub(console, "error");
    const server = serverWithRouteData(
      () => {
        throw new HttpError(429, {
          message: "Slow down",
          headers: { "Cache-Control": "no-store" },
        });
      },
      setBeforeNext("public, max-age=60"),
    );
    assertEquals(await dataCacheControl(server), "no-store");
  });

  it("leaves a response the loader returns to set its own policy", async () => {
    const server = serverWithRouteData(() => new Response("raw"));
    const response = await server.request("http://localhost/", {
      headers: { "X-Juniper-Route-Id": "/" },
    });
    assertEquals(await response.text(), "raw");
    assertEquals(response.headers.get("Cache-Control"), null);
  });

  describe("after middleware has already read the response", () => {
    it("still adds no-transform to the app's policy for streamed data", async () => {
      const server = serverWithRouteData(
        () => ({ later: Promise.resolve(1) }),
        cors(),
        setBeforeNext("public, max-age=60"),
      );
      assertEquals(
        await dataCacheControl(server),
        "public, max-age=60, no-transform",
      );
    });

    it("still prefers the policy a thrown error carries over the app's", async () => {
      using _log = stub(console, "error");
      const server = serverWithRouteData(
        () => {
          throw new HttpError(429, {
            message: "Slow down",
            headers: { "Cache-Control": "no-store" },
          });
        },
        cors(),
        setBeforeNext("public, max-age=60"),
      );
      assertEquals(await dataCacheControl(server), "no-store");
    });
  });

  for (
    const [kind, load] of [
      ["settled", () => ({ now: 1 })],
      ["streamed", () => ({ later: Promise.resolve(1) })],
    ] as const
  ) {
    it(`answers ${kind} data with 200 whatever status middleware set before next()`, async () => {
      const server = serverWithRouteData(load, async (c, next) => {
        c.status(404);
        await next();
      });
      const response = await server.request("http://localhost/", {
        headers: { "X-Juniper-Route-Id": "/" },
      });
      await response.arrayBuffer();
      assertEquals(response.status, 200);
    });
  }

  describe("for a redirect answering a data request", () => {
    async function redirectCacheControl(
      server: ReturnType<typeof serverWithRouteData>,
      method = "GET",
    ): Promise<string | null> {
      const response = await server.request("http://localhost/", {
        method,
        headers: { "X-Juniper-Route-Id": "/" },
      });
      assertEquals(response.status, 200);
      assertEquals(response.headers.get("X-Juniper"), "redirect");
      assertEquals(await response.json(), { location: "/sign-in" });
      return response.headers.get("Cache-Control");
    }

    const redirectFromMiddleware: MiddlewareHandler = (c) =>
      Promise.resolve(c.redirect("/sign-in"));

    const ownPolicy = { headers: { "Cache-Control": "no-store" } };

    for (const method of ["GET", "POST"]) {
      it(`keeps a redirect a ${method} handler returns out of shared caches and revalidated on every use`, async () => {
        const server = serverWithRouteData(() => redirect("/sign-in"));
        assertEquals(
          await redirectCacheControl(server, method),
          "private, no-cache",
        );
      });

      it(`keeps a redirect a ${method} handler throws out of shared caches and revalidated on every use`, async () => {
        const server = serverWithRouteData(() => {
          throw redirect("/sign-in");
        });
        assertEquals(
          await redirectCacheControl(server, method),
          "private, no-cache",
        );
      });
    }

    it("keeps a redirect from Hono middleware out of shared caches and revalidated on every use", async () => {
      const server = serverWithRouteData(
        () => ({ now: 1 }),
        redirectFromMiddleware,
      );
      assertEquals(await redirectCacheControl(server), "private, no-cache");
    });

    it("keeps a redirect response Hono middleware returns out of shared caches and revalidated on every use", async () => {
      const server = serverWithRouteData(
        () => ({ now: 1 }),
        () =>
          Promise.resolve(
            new Response(null, {
              status: 302,
              headers: { Location: "/sign-in" },
            }),
          ),
      );
      assertEquals(await redirectCacheControl(server), "private, no-cache");
    });

    it("uses the policy app middleware sets before next() for a loader's redirect", async () => {
      const server = serverWithRouteData(
        () => redirect("/sign-in"),
        setBeforeNext("public, max-age=60"),
      );
      assertEquals(await redirectCacheControl(server), "public, max-age=60");
    });

    it("uses the policy app middleware sets before next() for a middleware redirect", async () => {
      const server = serverWithRouteData(
        () => ({ now: 1 }),
        setBeforeNext("public, max-age=60"),
        redirectFromMiddleware,
      );
      assertEquals(await redirectCacheControl(server), "public, max-age=60");
    });

    it("sends the policy app middleware sets after next() unchanged", async () => {
      const server = serverWithRouteData(
        () => redirect("/sign-in"),
        async (c, next) => {
          await next();
          c.header("Cache-Control", "no-store");
        },
      );
      assertEquals(await redirectCacheControl(server), "no-store");
    });

    for (
      const [how, load] of [
        ["returns", () => redirect("/sign-in", ownPolicy)],
        ["throws", () => {
          throw redirect("/sign-in", ownPolicy);
        }],
      ] as const
    ) {
      it(`prefers the policy a redirect the loader ${how} carries over the app's and the default`, async () => {
        const server = serverWithRouteData(
          load,
          setBeforeNext("public, max-age=60"),
        );
        assertEquals(await redirectCacheControl(server), "no-store");
      });
    }

    it("prefers the policy a middleware redirect carries over the default", async () => {
      const server = serverWithRouteData(
        () => ({ now: 1 }),
        (c) => {
          c.header("Cache-Control", "no-store");
          return Promise.resolve(c.redirect("/sign-in"));
        },
      );
      assertEquals(await redirectCacheControl(server), "no-store");
    });

    it("builds an envelope that keeps the policy the redirect carries", () => {
      const envelope = toRedirectEnvelope(
        redirect("/sign-in", { headers: { "Cache-Control": "no-store" } }),
      );
      assertEquals(envelope.headers.get("Cache-Control"), "no-store");
    });

    describe("after middleware has already read the response", () => {
      it("still uses the default for a loader's redirect", async () => {
        const server = serverWithRouteData(
          () => redirect("/sign-in"),
          cors(),
        );
        assertEquals(await redirectCacheControl(server), "private, no-cache");
      });

      it("still uses the app's policy for a loader's redirect", async () => {
        const server = serverWithRouteData(
          () => redirect("/sign-in"),
          cors(),
          setBeforeNext("public, max-age=60"),
        );
        assertEquals(await redirectCacheControl(server), "public, max-age=60");
      });

      it("still prefers the policy a thrown redirect carries over the app's", async () => {
        const server = serverWithRouteData(
          () => {
            throw redirect("/sign-in", ownPolicy);
          },
          cors(),
          setBeforeNext("public, max-age=60"),
        );
        assertEquals(await redirectCacheControl(server), "no-store");
      });

      it("still uses the default for a middleware redirect", async () => {
        const server = serverWithRouteData(
          () => ({ now: 1 }),
          cors(),
          redirectFromMiddleware,
        );
        assertEquals(await redirectCacheControl(server), "private, no-cache");
      });
    });
  });
});

const DEFERRED_QUEUE = "__juniperDeferredHydration";

interface DeferredPageData {
  now: string;
  later: Promise<unknown>;
}

function serverWithDeferredPage(loaderData: () => unknown) {
  const client = new Client({
    path: "/",
    main: {
      default: ({ loaderData }: RouteProps<AnyParams, DeferredPageData>) => (
        <main>
          <p>{loaderData.now}</p>
          <Suspense fallback={<p>Loading later</p>}>
            <Await
              resolve={loaderData.later}
              errorElement={<p>Later failed</p>}
            >
              {(value: unknown) => <p>Later: {JSON.stringify(value)}</p>}
            </Await>
          </Suspense>
        </main>
      ),
    },
  });
  return createServer(import.meta.url, client, {
    path: "/",
    main: { loader: loaderData },
  });
}

function documentReader(response: Response) {
  const reader = response.body!.pipeThrough(new TextDecoderStream())
    .getReader();
  let html = "";
  async function readUntil(done: (html: string) => boolean): Promise<boolean> {
    while (!done(html)) {
      const chunk = await reader.read();
      if (chunk.done) return done(html);
      html += chunk.value;
    }
    return true;
  }
  return {
    get html(): string {
      return html;
    },
    readUntil,
    async readToEnd(): Promise<string> {
      try {
        await readUntil(() => false);
      } finally {
        reader.releaseLock();
      }
      return html;
    },
  };
}

function hasHydrationScript(html: string): boolean {
  const at = html.indexOf("window.__juniperHydrationData");
  return at >= 0 && html.indexOf("</script>", at) > at;
}

async function emittedBeforeSettling(
  document: ReturnType<typeof documentReader>,
  settle: () => void,
): Promise<boolean> {
  const timeout = new AbortController();
  const reading = document.readUntil(hasHydrationScript);
  const emitted = await Promise.race([
    reading,
    delay(2000, { signal: timeout.signal }).then(() => false, () => false),
  ]);
  timeout.abort();
  if (!emitted) {
    settle();
    await reading;
  }
  return emitted;
}

function deferredScripts(html: string): { attributes: string; body: string }[] {
  return Array.from(
    html.matchAll(/<script([^>]*)>([^<]*)<\/script>/g),
    ([, attributes, body]) => ({ attributes, body }),
  ).filter(({ body }) => body.includes(DEFERRED_QUEUE));
}

function browserScope(scope: Record<string, unknown> = {}) {
  let executed = 0;
  return {
    queue: () => (scope[DEFERRED_QUEUE] ??= []) as unknown[],
    runNewScripts(html: string): number {
      const scripts = deferredScripts(html).slice(executed);
      for (const { body } of scripts) {
        assertFalse(body.includes(" ") || body.includes(" "));
        new Function("globalThis", body)(scope);
      }
      executed += scripts.length;
      return scripts.length;
    },
  };
}

function track(promise: Promise<unknown>): { settled: boolean } {
  const state = { settled: false };
  promise.then(
    () => state.settled = true,
    () => state.settled = true,
  );
  return state;
}

describe("deferred data in the document", () => {
  beforeEach(resetRegistries);
  afterEach(resetRegistries);

  it("emits the hydration data before a deferred promise resolves, then resolves it from a later script", async () => {
    const later = Promise.withResolvers<{ text: string }>();
    const response = await serverWithDeferredPage(() => ({
      now: "critical",
      later: later.promise,
    })).request("http://localhost/");
    const document = documentReader(response);
    const settle = () => later.resolve({ text: hostile });

    assert(
      await emittedBeforeSettling(document, settle),
      "the hydration data waited for the deferred promise to settle",
    );
    assertStringIncludes(document.html, "Loading later");
    assertFalse(document.html.includes("Later: "));
    const hydrationTag = document.html.match(
      /<script[^>]*>(?=[^<]*__juniperHydrationData)/,
    )?.[0];
    assertExists(hydrationTag);
    assertStringIncludes(
      hydrationTag,
      'async=""',
      "a module script without async waits for the whole document to parse",
    );

    const browser = browserScope();
    using _queue = stub(env, "getDeferredHydration", browser.queue);
    using _parsed = stub(env, "whenDocumentParsed", () => {});
    const hydration = deserializeHydrationData(
      assertEscapedDocument(document.html, 4),
    );
    const loaderData = hydration.loaderData?.["/"] as DeferredPageData;
    assertEquals(loaderData.now, "critical");
    assertInstanceOf(loaderData.later, Promise);
    const client = track(loaderData.later);

    settle();
    const html = await document.readToEnd();
    assertStringIncludes(html, "Later: ");
    assertFalse(html.includes(hostile));
    await delay(0);
    assertFalse(client.settled, "only the streamed script settles it");

    assertEquals(browser.runNewScripts(html), 1);
    assertEquals(await loaderData.later, { text: hostile });
  });

  it(
    "emits the hydration data before a deferred promise rejects, then rejects it with the sanitized error",
    simulateEnvironment({ APP_ENV: "production" }, async () => {
      const later = Promise.withResolvers<never>();
      using _log = stub(console, "error");
      const response = await serverWithDeferredPage(() => ({
        now: "critical",
        later: later.promise,
      })).request("http://localhost/");
      const document = documentReader(response);
      const settle = () => later.reject(new Error("private database detail"));

      assert(
        await emittedBeforeSettling(document, settle),
        "the hydration data waited for the deferred promise to settle",
      );

      const browser = browserScope();
      using _queue = stub(env, "getDeferredHydration", browser.queue);
      using _parsed = stub(env, "whenDocumentParsed", () => {});
      const hydration = deserializeHydrationData(
        assertEscapedDocument(document.html, 4),
      );
      const { later: restored } = hydration.loaderData?.[
        "/"
      ] as DeferredPageData;
      const client = track(restored);

      settle();
      const html = await document.readToEnd();
      assertStringIncludes(html, "Later failed");
      assertFalse(html.includes("private database detail"));
      await delay(0);
      assertFalse(client.settled, "only the streamed script settles it");

      assertEquals(browser.runNewScripts(html), 1);
      await assertRejects(
        () => restored,
        HttpError,
        new HttpError(500).exposedMessage,
      );
    }),
  );

  it("streams a nested deferred promise as its own later script", async () => {
    const outer = Promise.withResolvers<{ inner: Promise<string> }>();
    const inner = Promise.withResolvers<string>();
    const response = await serverWithDeferredPage(() => ({
      now: "critical",
      later: outer.promise,
    })).request("http://localhost/");
    const document = documentReader(response);
    const settleAll = () => {
      outer.resolve({ inner: inner.promise });
      inner.resolve("deepest");
    };
    assert(
      await emittedBeforeSettling(document, settleAll),
      "the hydration data waited for the deferred promise to settle",
    );

    const browser = browserScope();
    using _queue = stub(env, "getDeferredHydration", browser.queue);
    using _parsed = stub(env, "whenDocumentParsed", () => {});
    const { later } = deserializeHydrationData(
      assertEscapedDocument(document.html, 4),
    ).loaderData?.["/"] as { later: Promise<{ inner: Promise<string> }> };

    outer.resolve({ inner: inner.promise });
    await document.readUntil((html) => deferredScripts(html).length > 0);
    assertEquals(browser.runNewScripts(document.html), 1);
    const { inner: restoredInner } = await later;
    assertInstanceOf(restoredInner, Promise);
    const innerState = track(restoredInner);
    await delay(0);
    assertFalse(innerState.settled, "the inner promise is still pending");

    inner.resolve("deepest");
    assertEquals(browser.runNewScripts(await document.readToEnd()), 1);
    assertEquals(await restoredInner, "deepest");
  });

  it("resolves deferred data whose scripts ran before the client read the document", async () => {
    const html = await (await serverWithDeferredPage(() => ({
      now: "critical",
      later: Promise.resolve({ inner: Promise.resolve(7) }),
    })).request("http://localhost/")).text();
    const browser = browserScope();
    assertEquals(browser.runNewScripts(html), 2);
    using _queue = stub(env, "getDeferredHydration", browser.queue);
    using _parsed = stub(env, "whenDocumentParsed", (parsed) => parsed());
    const { later } = deserializeHydrationData(assertEscapedDocument(html, 4))
      .loaderData?.["/"] as { later: Promise<{ inner: Promise<number> }> };
    assertEquals(await (await later).inner, 7);
  });

  it("rejects deferred data still pending once the document is parsed", async () => {
    const html = await (await serverWithDeferredPage(() => ({
      now: "critical",
      later: Promise.resolve("never delivered"),
    })).request("http://localhost/")).text();
    const browser = browserScope();
    using _queue = stub(env, "getDeferredHydration", browser.queue);
    let parsed: (() => void) | undefined;
    using _parsed = stub(env, "whenDocumentParsed", (callback) => {
      parsed = callback;
    });
    const { later } = deserializeHydrationData(assertEscapedDocument(html, 4))
      .loaderData?.["/"] as { later: Promise<string> };
    assertExists(parsed);
    parsed();
    await assertRejects(
      () => later,
      Error,
      "Unexpected end of document before all promises resolved",
    );
  });

  it("puts the CSP nonce on every deferred resolution script", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => <div>Nonced</div> },
    });
    const server = createServer(import.meta.url, client, {
      path: "/",
      main: {
        loader: () => ({ later: Promise.resolve({ inner: delay(1) }) }),
      },
    });
    const app = new Hono();
    app.use(secureHeaders({
      contentSecurityPolicy: { scriptSrc: ["'self'", NONCE] },
    }));
    app.route("/", server);
    const response = await app.request("http://localhost/");
    const html = await response.text();
    const nonce = response.headers.get("content-security-policy")
      ?.match(/'nonce-([^']+)'/)?.[1];
    assertExists(nonce);
    const scripts = deferredScripts(html);
    assertEquals(scripts.length, 2);
    for (const { attributes } of scripts) {
      assertStringIncludes(attributes, `nonce="${nonce}"`);
    }
  });

  it("ends the document when the request aborts while a deferred promise never settles", async () => {
    const controller = new AbortController();
    using _log = stub(console, "error");
    const response = await serverWithDeferredPage(() => ({
      now: "critical",
      later: new Promise<never>(() => {}),
    })).request("http://localhost/", { signal: controller.signal });
    const document = documentReader(response);
    assert(
      await emittedBeforeSettling(document, () => controller.abort()),
      "the hydration data waited for the deferred promise to settle",
    );
    controller.abort(new Error("request canceled"));
    await document.readToEnd().catch(() => {});
    assertEquals(deferredScripts(document.html), []);
  });
});

describe("deferred data under a clobbered queue global", () => {
  const global = globalThis as Record<string, unknown>;
  beforeEach(() => {
    resetRegistries();
    global[DEFERRED_QUEUE] = { tagName: "A", id: DEFERRED_QUEUE };
  });
  afterEach(() => {
    delete global[DEFERRED_QUEUE];
    resetRegistries();
  });

  async function renderDeferred(): Promise<string> {
    return await (await serverWithDeferredPage(() => ({
      now: "critical",
      later: Promise.resolve({ inner: Promise.resolve("clobber-proof") }),
    })).request("http://localhost/")).text();
  }

  it("resolves when the document's scripts run before the client reads the payload", async () => {
    const html = await renderDeferred();
    assertEquals(browserScope(global).runNewScripts(html), 2);
    const { later } = deserializeHydrationData(assertEscapedDocument(html, 4))
      .loaderData?.["/"] as { later: Promise<{ inner: Promise<string> }> };
    assertEquals(await (await later).inner, "clobber-proof");
  });

  it("resolves when the client reads the payload before the document's scripts run", async () => {
    const html = await renderDeferred();
    const { later } = deserializeHydrationData(assertEscapedDocument(html, 4))
      .loaderData?.["/"] as { later: Promise<{ inner: Promise<string> }> };
    assertEquals(browserScope(global).runNewScripts(html), 2);
    assertEquals(await (await later).inner, "clobber-proof");
  });
});

describe("complete documents for crawlers", () => {
  beforeEach(resetRegistries);
  afterEach(resetRegistries);

  const ARRIVED =
    "<p>Later: <!-- -->{&quot;text&quot;:&quot;arrived&quot;}</p>";
  const crawler =
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const browser =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

  function slowPage() {
    return serverWithDeferredPage(() => ({
      now: "critical",
      later: delay(20).then(() => ({ text: "arrived" })),
    }));
  }

  function hungPage() {
    return serverWithDeferredPage(() => ({
      now: "critical",
      later: new Promise<never>(() => {}),
    }));
  }

  function assertCompleteDocument(html: string): void {
    assertStringIncludes(html, ARRIVED);
    assertFalse(html.includes("Loading later"), "a fallback was sent");
    assertFalse(html.includes('id="S:'), "a hidden segment was streamed");
    assertFalse(html.includes("$RC"), "a boundary swap script was streamed");
  }

  function assertFallbackDocument(html: string | undefined): void {
    assertExists(html, "the complete document never arrived");
    assert(html.endsWith("</html>"), "the document did not complete");
    assertStringIncludes(html, "<p>critical</p>");
    assertStringIncludes(html, "Loading later");
    assertFalse(html.includes("Later: "));
    assertFalse(html.includes('id="S:'), "a hidden segment was streamed");
    assertFalse(html.includes("$RC"), "a boundary swap script was streamed");
  }

  function assertLoggedTimeoutOnce(log: { calls: { args: unknown[] }[] }) {
    assertEquals(log.calls.map((call) => call.args), [[
      "Deferred data did not settle within 10000ms; sending its fallbacks.",
    ]]);
  }

  it("sends a crawler the complete document, which still hydrates", async () => {
    const response = await slowPage().request("http://localhost/", {
      headers: { "User-Agent": crawler },
    });
    const html = await response.text();
    assertCompleteDocument(html);

    const scope = browserScope();
    using _queue = stub(env, "getDeferredHydration", scope.queue);
    using _parsed = stub(env, "whenDocumentParsed", () => {});
    scope.runNewScripts(html);
    const { later } = deserializeHydrationData(assertEscapedDocument(html, 4))
      .loaderData?.["/"] as DeferredPageData;
    assertEquals(await later, { text: "arrived" });
  });

  for (
    const [label, headers] of [
      ["a browser", { "User-Agent": browser }],
      ["a request without a user agent", {}],
      ["a browser sending the removed JavaScript cookie", {
        "User-Agent": browser,
        Cookie: "juniper_js=1",
      }],
    ] as const
  ) {
    it(`streams the fallback first to ${label}, varying only by route`, async () => {
      const response = await slowPage().request("http://localhost/", {
        headers,
      });
      assertEquals(
        (response.headers.get("Vary") ?? "").toLowerCase().split(/,\s*/)
          .sort(),
        ["accept", "x-juniper-route-id"],
      );
      const document = documentReader(response);
      await document.readUntil(hasHydrationScript);
      assertStringIncludes(document.html, "Loading later");
      assertFalse(document.html.includes("Later: "));
      const html = await document.readToEnd();
      assertStringIncludes(html, 'id="S:');
      assertStringIncludes(html, ARRIVED);
    });
  }

  it("inlines every settled section of a crawler's document however large the page is", async () => {
    const shell = "Critical content. ".repeat(1000);
    const section = "Deferred content. ".repeat(100);
    const client = new Client({
      path: "/",
      main: {
        default: ({ loaderData }: RouteProps<AnyParams, DeferredPageData>) => (
          <main>
            <p>{shell}</p>
            {[0, 1].map((index) => (
              <Suspense key={index} fallback={<p>Loading later</p>}>
                <Await resolve={loaderData.later}>
                  {() => <p>{section}</p>}
                </Await>
              </Suspense>
            ))}
          </main>
        ),
      },
    });
    const server = createServer(import.meta.url, client, {
      path: "/",
      main: {
        loader: () => ({ now: "critical", later: delay(20) }),
      },
    });
    const html = await (await server.request("http://localhost/", {
      headers: { "User-Agent": crawler },
    })).text();
    assertEquals(html.split(section).length - 1, 2, "a section was outlined");
    assertFalse(html.includes("Loading later"), "a fallback was sent");
    assertFalse(html.includes('id="S:'), "a hidden segment was streamed");
    assertFalse(html.includes("$RC"), "a swap script was streamed");
  });

  it("waits ten seconds for a crawler's deferred data, then sends the fallbacks", async () => {
    using log = stub(console, "error");
    const request = new AbortController();
    let html: string | undefined;
    let reading: Promise<unknown>;
    {
      using time = new FakeTime();
      reading = Promise.resolve(
        hungPage().request("http://localhost/", {
          headers: { "User-Agent": crawler },
          signal: request.signal,
        }),
      ).then((response) => response.text()).then((text) => html = text);
      const settle = async () => {
        for (let tick = 0; tick < 100 && html === undefined; tick++) {
          await time.tickAsync(0);
        }
      };
      await time.tickAsync(9_999);
      await settle();
      assertEquals(html, undefined, "the document completed early");
      await time.tickAsync(1);
      await settle();
    }
    const completed = html;
    if (completed === undefined) request.abort();
    await reading.catch(() => {});
    assertFallbackDocument(completed);
    assertLoggedTimeoutOnce(log);
  });

  it("does not cut off a browser's streamed document after ten seconds", async () => {
    using log = stub(console, "error");
    const later = Promise.withResolvers<{ text: string }>();
    let html: string | undefined;
    let reading: Promise<unknown>;
    {
      using time = new FakeTime();
      reading = Promise.resolve(
        serverWithDeferredPage(() => ({
          now: "critical",
          later: later.promise,
        }))
          .request("http://localhost/", {
            headers: { "User-Agent": browser },
          }),
      ).then((response) => response.text()).then((text) => html = text);
      const settle = async () => {
        for (let tick = 0; tick < 100 && html === undefined; tick++) {
          await time.tickAsync(0);
        }
      };
      await time.tickAsync(10_001);
      await settle();
      assertEquals(html, undefined, "the streamed document ended early");
      later.resolve({ text: "arrived" });
      await settle();
    }
    await reading;
    assertExists(html);
    assertStringIncludes(html, ARRIVED);
    assertEquals(log.calls.length, 0);
  });

  function serverWithDeniedPage() {
    const help = delay(20).then(() => "Ask an administrator");
    const client = new Client({
      path: "/",
      main: {
        default: () => <p>Home</p>,
        ErrorBoundary: () => (
          <main>
            <p>Denied page</p>
            <Suspense fallback={<p>Loading help</p>}>
              <Await resolve={help}>
                {(text: string) => <p>Help: {text}</p>}
              </Await>
            </Suspense>
          </main>
        ),
      },
    });
    return createServer(import.meta.url, client, {
      path: "/",
      main: {
        loader: () => ({ later: delay(20).then(() => "root data") }),
        default: new Hono().use(() => {
          throw new HttpError(403);
        }),
      },
    });
  }

  it("completes an error document before sending it to a crawler", async () => {
    using _log = stub(console, "error");
    const response = await serverWithDeniedPage().request(
      "http://localhost/",
      { headers: { "User-Agent": crawler } },
    );
    assertEquals(response.status, 403);
    const html = await response.text();
    assertStringIncludes(html, "<p>Help: <!-- -->Ask an administrator</p>");
    assertFalse(html.includes("Loading help"), "a fallback was sent");
    assertFalse(html.includes('id="S:'), "a hidden segment was streamed");
    assertFalse(html.includes("$RC"), "a boundary swap script was streamed");
  });

  it("streams an error document to a browser", async () => {
    using _log = stub(console, "error");
    const response = await serverWithDeniedPage().request(
      "http://localhost/",
      { headers: { "User-Agent": browser } },
    );
    assertEquals(response.status, 403);
    const html = await response.text();
    assertStringIncludes(html, "Loading help");
    assertStringIncludes(html, 'id="S:');
  });

  it("leaves a Vary: * document untouched", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => <p>Home</p> },
    });
    const server = createServer(import.meta.url, client, {
      path: "/",
      main: {
        default: new Hono().use(async (c, next) => {
          c.header("Vary", "*");
          await next();
        }),
        loader: () => "root data",
      },
    });
    const response = await server.request("http://localhost/");
    await response.arrayBuffer();
    assertEquals(response.headers.get("Vary"), "*");
  });
});
