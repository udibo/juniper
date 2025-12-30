import {
  assert,
  assertEquals,
  assertExists,
  assertIsError,
  assertObjectMatch,
  assertRejects,
} from "@std/assert";
import { beforeAll, beforeEach, describe, it } from "@std/testing/bdd";
import { assertSpyCalls, stub } from "@std/testing/mock";
import { HttpError } from "@udibo/juniper";
import { Outlet } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import SuperJSON from "superjson";
import serialize from "serialize-javascript";

import { Client, isSerializedError } from "@udibo/juniper/client";
import type {
  HydrationData,
  RootClientRoute,
  SerializedError,
} from "@udibo/juniper/client";
import type { RouteModule } from "@udibo/juniper";

import { simulateBrowser } from "./utils/testing.internal.ts";

import {
  createLazyRoute,
  createRoute,
  deserializeErrorDefault,
  deserializeHydrationData,
} from "./_client.tsx";
import { serializeHydrationData } from "./_server.tsx";

const routes = {
  path: "/",
  main: {
    default: () => <Outlet />,
  },
  index: () => Promise.resolve({ default: () => <div>Index</div> }),
  catchall: () => Promise.resolve({ default: () => <div>Catchall</div> }),
  children: [
    {
      path: "about",
      main: () => Promise.resolve({ default: () => <div>About</div> }),
    },
    {
      path: "blog",
      main: () => Promise.resolve({ default: () => <Outlet /> }),
      index: () => Promise.resolve({ default: () => <div>Blog Index</div> }),
      children: [
        {
          path: "create",
          main: () =>
            Promise.resolve({ default: () => <div>Blog Create</div> }),
        },
        {
          path: ":id",
          main: () => Promise.resolve({ default: () => <div>Blog Post</div> }),
        },
      ],
    },
  ],
} satisfies RootClientRoute;

class CustomError extends Error {
  detail: string;
  constructor(message: string, detail: string) {
    super(message);
    this.name = "CustomError";
    this.detail = detail;
  }
}

interface SerializedCustomError extends SerializedError {
  __subType: "CustomError";
  message: string;
  detail: string;
}
function isSerializedCustomError(
  serializedError: unknown,
): serializedError is SerializedCustomError {
  return isSerializedError(serializedError) &&
    serializedError.__subType === "CustomError";
}

function serializeError(
  error: unknown,
): SerializedCustomError | undefined {
  if (error instanceof CustomError) {
    return {
      __type: "Error",
      __subType: "CustomError",
      message: error.message,
      detail: error.detail,
    };
  }
}

function deserializeError(serializedError: unknown): CustomError | undefined {
  if (
    isSerializedCustomError(serializedError)
  ) {
    return new CustomError(serializedError.message, serializedError.detail);
  }
}

describe("Client", () => {
  it("should create a client with the correct structure", () => {
    const client = new Client(routes);

    assertEquals(client.rootRoute.path, "/");
    assertEquals(client.routeFileMap.size, 8);
    assertEquals(client.routeObjectMap.size, 8);
    assertEquals(client.routeObjects.length, 1);

    const routeObject = client.routeObjects[0];
    assertObjectMatch(routeObject, {
      "path": "/",
    });
    assertExists(routeObject.children);
    assertEquals(client.routeFileMap.get("/"), routes.main);
    assertEquals(client.routeObjectMap.get("/"), routeObject);

    assertObjectMatch(routeObject.children[0], {
      "index": true,
    });
    assertExists(routeObject.children[0].lazy);
    assertEquals(client.routeFileMap.get("/index"), routes.index);
    assertEquals(client.routeObjectMap.get("/index"), routeObject.children[0]);

    assertObjectMatch(routeObject.children[1], {
      "path": "about",
    });
    assertExists(routeObject.children[1].lazy);
    assertEquals(client.routeFileMap.get("/about"), routes.children[0].main);
    assertEquals(client.routeObjectMap.get("/about"), routeObject.children[1]);

    assertObjectMatch(routeObject.children[2], {
      "path": "blog",
    });
    assertExists(routeObject.children[2].lazy);
    assertEquals(client.routeFileMap.get("/blog"), routes.children[1].main);
    assertEquals(client.routeObjectMap.get("/blog"), routeObject.children[2]);

    assertExists(routeObject.children[2].children);
    assertObjectMatch(routeObject.children[2].children[0], {
      "index": true,
    });
    assertExists(routeObject.children[2].children[0].lazy);
    assertEquals(
      client.routeFileMap.get("/blog/index"),
      routes.children[1].index,
    );
    assertEquals(
      client.routeObjectMap.get("/blog/index"),
      routeObject.children[2].children[0],
    );

    assertObjectMatch(routeObject.children[2].children[1], {
      "path": "create",
    });
    assertExists(routeObject.children[2].children[1].lazy);
    assertEquals(
      client.routeFileMap.get("/blog/create"),
      routes.children[1].children?.[0].main,
    );
    assertEquals(
      client.routeObjectMap.get("/blog/create"),
      routeObject.children[2].children[1],
    );

    assertObjectMatch(routeObject.children[2].children[2], {
      "path": ":id",
    });
    assertExists(routeObject.children[2].children[2].lazy);
    assertEquals(
      client.routeFileMap.get("/blog/[id]"),
      routes.children[1].children?.[1].main,
    );
    assertEquals(
      client.routeObjectMap.get("/blog/[id]"),
      routeObject.children[2].children[2],
    );

    assertObjectMatch(routeObject.children[3], {
      "path": "*",
    });
    assertExists(routeObject.children[3].lazy);
    assertEquals(
      client.routeFileMap.get("/[...]"),
      routes.catchall,
    );
    assertEquals(client.routeObjectMap.get("/[...]"), routeObject.children[3]);
  });
});

describe("createRoute", () => {
  let routeFile: RouteModule;
  beforeEach(() => {
    routeFile = {
      default: () => <div>Route</div>,
    } satisfies RouteModule;
  });

  it("from a file with only default export", () => {
    const routeObject = createRoute(routeFile);
    assertExists(routeObject.Component);
    assertEquals(typeof routeObject.Component, "function");
    assertEquals(routeObject.ErrorBoundary, undefined);
    assertEquals(routeObject.loader, undefined);
    assertEquals(routeObject.action, undefined);
  });

  it("from a file with ErrorBoundary export", () => {
    routeFile.ErrorBoundary = () => <div>Error Boundary</div>;
    const routeObject = createRoute(routeFile);
    assertExists(routeObject.Component);
    assertEquals(typeof routeObject.Component, "function");
    assertExists(routeObject.ErrorBoundary);
    assertEquals(typeof routeObject.ErrorBoundary, "function");
    assertEquals(routeObject.loader, undefined);
    assertEquals(routeObject.action, undefined);
  });

  it("from a file with loader export", () => {
    routeFile.loader = () => Promise.resolve({});
    const routeObject = createRoute(routeFile);
    assertExists(routeObject.Component);
    assertEquals(typeof routeObject.Component, "function");
    assertEquals(routeObject.ErrorBoundary, undefined);
    assertEquals(typeof routeObject.loader, "function");
    assertEquals(routeObject.action, undefined);
  });

  it("from a file with action export", () => {
    routeFile.action = () => Promise.resolve({});
    const routeObject = createRoute(routeFile);
    assertExists(routeObject.Component);
    assertEquals(typeof routeObject.Component, "function");
    assertEquals(routeObject.ErrorBoundary, undefined);
    assertEquals(routeObject.loader, undefined);
    assertEquals(typeof routeObject.action, "function");
  });

  it("from a file with HydrateFallback export", () => {
    routeFile.HydrateFallback = () => <div>Loading...</div>;
    const routeObject = createRoute(routeFile);
    assertExists(routeObject.Component);
    assertEquals(typeof routeObject.Component, "function");
    assertEquals(typeof routeObject.HydrateFallback, "function");
    assertEquals(routeObject.ErrorBoundary, undefined);
    assertEquals(routeObject.loader, undefined);
    assertEquals(routeObject.action, undefined);
  });

  it("from a file with loader export and HydrateFallback export", () => {
    routeFile.loader = () => Promise.resolve({});
    routeFile.HydrateFallback = () => <div>Loading...</div>;
    const routeObject = createRoute(routeFile);
    assertExists(routeObject.Component);
    assertEquals(typeof routeObject.Component, "function");
    assertEquals(typeof routeObject.HydrateFallback, "function");
    assertEquals(routeObject.ErrorBoundary, undefined);
    assertEquals(typeof routeObject.loader, "function");
    assertEquals(routeObject.action, undefined);
  });

  it("should not have HydrateFallback when not exported", () => {
    const routeObject = createRoute(routeFile);
    assertEquals(routeObject.HydrateFallback, undefined);
  });

  it("should allow serverAction after reading request formData", async () => {
    const formData = new FormData();
    formData.set("title", "Hello");
    const request = new Request("http://localhost/blog", {
      method: "POST",
      body: formData,
    });

    routeFile.action = async ({ request, serverAction }) => {
      const parsed = await request.formData();
      assertEquals(parsed.get("title"), "Hello");
      return await serverAction();
    };

    const payload = { ok: true };
    using fetchStub = stub(
      globalThis,
      "fetch",
      (_input: RequestInfo | URL, _init?: RequestInit) => {
        const serialized = SuperJSON.serialize(payload);
        return Promise.resolve(
          new Response(JSON.stringify(serialized), {
            headers: {
              "Content-Type": "application/json",
              "X-Juniper": "serialized",
            },
          }),
        );
      },
    );

    const routeObject = createRoute(routeFile, { action: true }, "route-1");
    assertExists(routeObject.action);
    const actionArgs = {
      context: {} as never,
      params: {},
      request,
      preventScrollReset: undefined,
      submission: undefined,
      unstable_viewTransition: undefined,
      unstable_fetcherSubmission: undefined,
      unstable_data: undefined,
      unstable_allowRouteDeterminism: undefined,
      unstable_pattern: "/blog",
    } as ActionFunctionArgs;
    const result = await routeObject.action(actionArgs);
    assertEquals(result, payload);
    assertSpyCalls(fetchStub, 1);
    const fetchBody = fetchStub.calls[0].args[1]?.body;
    assert(fetchBody instanceof FormData);
    assertEquals(fetchBody.get("title"), "Hello");
  });
});

describe("createLazyRoute", () => {
  let routeFile: RouteModule;
  const lazyRouteFile = () => Promise.resolve(routeFile);
  beforeEach(() => {
    routeFile = {
      default: () => <div>Lazy Route</div>,
    } satisfies RouteModule;
  });

  it("from a file with only default export", async () => {
    const lazyRouteObject = createLazyRoute(lazyRouteFile);
    const { Component, ErrorBoundary, loader } = await lazyRouteObject();
    assertExists(Component);
    assertEquals(typeof Component, "function");
    assertEquals(ErrorBoundary, undefined);
    assertEquals(loader, undefined);
  });

  it("from a file with ErrorBoundary export", async () => {
    routeFile.ErrorBoundary = () => <div>Error Boundary</div>;
    const lazyRouteObject = createLazyRoute(lazyRouteFile);
    const { Component, ErrorBoundary, loader } = await lazyRouteObject();
    assertExists(Component);
    assertEquals(typeof Component, "function");
    assertExists(ErrorBoundary);
    assertEquals(typeof ErrorBoundary, "function");
    assertEquals(loader, undefined);
  });

  it("from a file with loader export", async () => {
    routeFile.loader = () => Promise.resolve({});
    const lazyRouteObject = createLazyRoute(lazyRouteFile);
    const { Component, ErrorBoundary, loader, action } =
      await lazyRouteObject();
    assertExists(Component);
    assertEquals(typeof Component, "function");
    assertEquals(ErrorBoundary, undefined);
    assertEquals(typeof loader, "function");
    assertEquals(action, undefined);
  });

  it("from a file with HydrateFallback export", async () => {
    routeFile.HydrateFallback = () => <div>Loading...</div>;
    const lazyRouteObject = createLazyRoute(lazyRouteFile);
    const { Component, ErrorBoundary, HydrateFallback, loader, action } =
      await lazyRouteObject();
    assertExists(Component);
    assertEquals(typeof Component, "function");
    assertEquals(typeof HydrateFallback, "function");
    assertEquals(ErrorBoundary, undefined);
    assertEquals(loader, undefined);
    assertEquals(action, undefined);
  });
});

describe("isSerializedError", () => {
  it("should return true if the value is a serialized error", () => {
    assertEquals(isSerializedError({ __type: "Error" }), true);
    assertEquals(
      isSerializedError({ __type: "Error", __subType: "HttpError" }),
      true,
    );
    assertEquals(
      isSerializedError({ __type: "Error", __subType: "CustomError" }),
      true,
    );
  });

  it("should return false if the value is not a serialized error", () => {
    assertEquals(isSerializedError({}), false);
    assertEquals(isSerializedError({ __type: "Unknown" }), false);
    assertEquals(isSerializedError(null), false);
    assertEquals(isSerializedError(undefined), false);
  });
});

describe("deserializeErrorDefault", () => {
  it("should deserialize a serialized HttpError", () => {
    const error = deserializeErrorDefault({
      __type: "Error",
      __subType: "HttpError",
      status: 500,
      detail: "Oops",
    });
    assertIsError(error, HttpError, "Oops");
    assertEquals(error.name, "InternalServerError");
    assertEquals(error.status, 500);
  });

  it("should deserialize a serialized TypeError", () => {
    const error = deserializeErrorDefault({
      __type: "Error",
      __subType: "TypeError",
      message: "Oops",
    });
    assertIsError(error, TypeError, "Oops");
  });

  it("should deserialize a serialized Error", () => {
    const error = deserializeErrorDefault({
      __type: "Error",
      message: "Oops",
    });
    assertIsError(error, Error, "Oops");
  });

  it("should deserialize a serialized error with a stack", () => {
    const error = deserializeErrorDefault({
      __type: "Error",
      message: "Oops",
      stack: "Error: Oops\n    at test.ts:1:1",
    });
    assertIsError(error, Error, "Oops");
    assertEquals(error.stack, "Error: Oops\n    at test.ts:1:1");
  });

  it("should deserialize a serialized error without global error constructor for subtype", () => {
    const error = deserializeErrorDefault({
      __type: "Error",
      __subType: "Unknown",
      message: "Oops",
    });
    assertIsError(error, Error, "Oops");
  });
});

describe("getHydrationData", () => {
  const errorHydrationData: HydrationData = {
    matches: [],
    errors: {
      "/": new Error("Oops"),
      "/about": new TypeError("Wrong type"),
      "/blog": new HttpError(400, "Bad request"),
      "/blog/create": new CustomError("Custom error", "Custom detail"),
    },
    loaderData: {},
  };

  describe("deserializes errors", () => {
    it(
      "with default deserializeError function",
      simulateBrowser(errorHydrationData, { serializeError }, () => {
        const client = new Client(routes);
        const data = client.getHydrationData();
        assertObjectMatch(data, {
          loaderData: {},
        });
        assertExists(data.errors);
        assertIsError(data.errors["/"], Error, "Oops");
        assertIsError(data.errors["/about"], TypeError, "Wrong type");

        assertIsError(data.errors["/blog"], HttpError, "Bad request");
        assertEquals(data.errors["/blog"].name, "BadRequestError");
        assertEquals(data.errors["/blog"].status, 400);

        assertIsError(data.errors["/blog/create"], Error, "Custom error");
        assertEquals(data.errors["/blog/create"] instanceof CustomError, false);
      }),
    );

    it(
      "with custom deserializeError function",
      simulateBrowser(errorHydrationData, { serializeError }, () => {
        const client = new Client({
          ...routes,
          main: {
            ...routes.main,
            deserializeError,
          },
        });
        const data = client.getHydrationData();
        assertObjectMatch(data, {
          loaderData: {},
        });
        assertExists(data.errors);
        assertIsError(data.errors["/"], Error, "Oops");
        assertIsError(data.errors["/about"], TypeError, "Wrong type");

        assertIsError(data.errors["/blog"], HttpError, "Bad request");
        assertEquals(data.errors["/blog"].name, "BadRequestError");
        assertEquals(data.errors["/blog"].status, 400);

        assertIsError(data.errors["/blog/create"], CustomError, "Custom error");
        assertEquals(data.errors["/blog/create"].detail, "Custom detail");
      }),
    );
  });

  describe("deserializes loaderData and actionData", () => {
    it(
      "should deserialize loaderData and actionData",
      simulateBrowser({
        matches: [],
        errors: undefined,
        loaderData: {
          "/": {
            user: { name: "John", age: 30 },
            settings: { theme: "dark" },
          },
          "/about": {
            posts: [{ id: 1, title: "Hello" }],
            asyncData: Promise.resolve("resolved data"),
          },
        },
        actionData: {
          "/": {
            result: "success",
            data: { id: 1 },
          },
        },
      }, async () => {
        const client = new Client(routes);
        const data = client.getHydrationData();

        assertExists(data.loaderData);
        assertExists(data.actionData);

        assertEquals(data.loaderData["/"], {
          user: { name: "John", age: 30 },
          settings: { theme: "dark" },
        });

        assertExists(data.loaderData["/about"]);

        const loaderData = data.loaderData["/about"];
        assertExists(loaderData);
        assertExists(loaderData.posts);
        assertExists(loaderData.asyncData);
        assert(loaderData.asyncData instanceof Promise);
        assertEquals(await loaderData.asyncData, "resolved data");

        assertEquals(data.actionData["/"], {
          result: "success",
          data: { id: 1 },
        });
      }),
    );

    it("should handle rejected promises in loaderData and actionData", async () => {
      const hydrationData: HydrationData = {
        matches: [],
        errors: undefined,
        loaderData: {
          "/blog": {
            error: Promise.reject(new Error("Loader failed")),
          },
        },
        actionData: {
          "/about": {
            error: Promise.reject(new HttpError(422, "Validation failed")),
          },
        },
      };
      await simulateBrowser(hydrationData, async () => {
        const client = new Client(routes);
        const data = client.getHydrationData();

        await assertRejects(
          () => data.loaderData!["/blog"].error,
          Error,
          "Loader failed",
        );

        const error = await assertRejects(
          () => data.actionData!["/about"].error,
          HttpError,
          "Validation failed",
        );
        assertEquals(error.status, 422);
      })();
    });

    it(
      "should handle missing loaderData and actionData",
      simulateBrowser({
        matches: [],
      }, () => {
        const client = new Client(routes);
        const data = client.getHydrationData();

        assertEquals(data.loaderData, undefined);
        assertEquals(data.actionData, undefined);
      }),
    );

    it(
      "should handle null actionData",
      simulateBrowser({
        matches: [],
        loaderData: {
          "/": { data: "test" },
        },
        actionData: null,
      }, () => {
        const client = new Client(routes);
        const data = client.getHydrationData();

        assertExists(data.loaderData);
        assertEquals(data.actionData, undefined);
      }),
    );
  });

  describe("loadLazyMatches", () => {
    it("should load lazy routes for matches", async () => {
      const mockComponent = () => <div>Mock Component</div>;
      const mockErrorBoundary = () => <div>Mock Error Boundary</div>;
      const mockLoader = () => Promise.resolve({ data: "test" });
      const mockAction = () => Promise.resolve({ result: "success" });

      const mockLazyRouteFile = () =>
        Promise.resolve({
          default: mockComponent,
          ErrorBoundary: mockErrorBoundary,
          loader: mockLoader,
          action: mockAction,
        });

      const client = new Client(routes);

      const route = client.routeObjectMap.get("/about");

      if (route) route.lazy = mockLazyRouteFile;

      await client.loadLazyMatches([{ id: "/about" }]);

      if (route) {
        assertEquals(route.lazy, undefined);
      }
    });

    it("should handle routes without lazy property", async () => {
      const client = new Client(routes);
      const route = client.routeObjectMap.get("/");

      if (route) {
        delete route.lazy;
      }

      await client.loadLazyMatches([{ id: "/" }]);

      if (route) {
        assertEquals(route.lazy, undefined);
      }
    });

    it("should handle missing matches in hydration data", async () => {
      const client = new Client(routes);

      await client.loadLazyMatches([]);
    });

    it("should handle empty matches array", async () => {
      const client = new Client(routes);

      await client.loadLazyMatches([]);
    });

    it("should handle missing hydration data", async () => {
      const client = new Client(routes);

      await client.loadLazyMatches([]);
    });

    it("should handle lazy route that throws an error", async () => {
      const mockLazyRouteFile = () =>
        Promise.reject(new Error("Lazy load failed"));

      const client = new Client(routes);
      const route = client.routeObjectMap.get("/about");

      if (route) route.lazy = mockLazyRouteFile;

      try {
        await client.loadLazyMatches([{ id: "/about" }]);
        assertEquals(true, false, "Should have thrown an error");
      } catch (error) {
        assertIsError(error, Error, "Lazy load failed");
      }
    });

    it("should only set properties that exist in the lazy route file", async () => {
      const mockComponent = () => <div>Mock Component</div>;
      const mockLoader = () => Promise.resolve({ data: "test" });

      const mockLazyRouteFile = () =>
        Promise.resolve({
          default: mockComponent,
          loader: mockLoader,
        });

      const client = new Client(routes);
      const route = client.routeObjectMap.get("/about");

      if (route) route.lazy = mockLazyRouteFile;

      await client.loadLazyMatches([{ id: "/about" }]);

      if (route) {
        assertEquals(route.lazy, undefined);
      }
    });

    it("should handle non-existent route IDs in matches", async () => {
      const client = new Client(routes);

      await client.loadLazyMatches([{ id: "/non-existent-route" }]);
    });
  });
});

describe("HydrationData serialization and deserialization", () => {
  let hydrationData: HydrationData, deserializedHydrationData: HydrationData;

  beforeAll(async () => {
    hydrationData = {
      publicEnv: { APP_ENV: "test", APP_NAME: "TestApp" },
      serializedContext: { testKey: "testValue" },
      matches: [{ id: "/" }, { id: "/blog" }, { id: "/blog/index" }],
      errors: {
        "/": new Error("Oops"),
        "/blog": new TypeError("Wrong type"),
        "/blog/index": new HttpError(400, "Bad request"),
      },
      loaderData: {
        "/": {
          user: Promise.resolve({ name: "John", age: 30 }),
          settings: { theme: "dark" },
        },
        "/blog": {
          posts: [{ id: 1, title: "Hello" }],
          comments: Promise.resolve([{ id: 1, content: "Comment" }]),
          regexp: /hello/g,
          asyncRegexp: Promise.resolve(/world/g),
          date: new Date("2025-01-01"),
          asyncDate: Promise.resolve(new Date("2025-02-01")),
          xss: "</script><script>alert('gotcha!')</script>",
          asyncXss: Promise.resolve(
            "</script><script>alert('gotcha!')</script>",
          ),
          error: Promise.reject(new Error("Loader failed")),
          typeError: Promise.reject(new TypeError("Loader wrong type")),
          httpError: Promise.reject(new HttpError(400, "Loader bad request")),
          customError: Promise.reject(
            new CustomError("Loader custom error", "Loader custom detail"),
          ),
        },
      },
      actionData: {
        "/": {
          user: Promise.resolve({ name: "John", age: 30 }),
          settings: { theme: "dark" },
        },
        "/blog": {
          posts: [{ id: 1, title: "Hello" }],
          comments: Promise.resolve([{ id: 1, content: "Comment" }]),
          regexp: /hello/g,
          asyncRegexp: Promise.resolve(/world/g),
          date: new Date("2025-01-01"),
          asyncDate: Promise.resolve(new Date("2025-02-01")),
          xss: "</script><script>alert('gotcha!')</script>",
          asyncXss: Promise.resolve(
            "</script><script>alert('gotcha!')</script>",
          ),
          error: Promise.reject(new Error("Action failed")),
          typeError: Promise.reject(new TypeError("Action wrong type")),
          httpError: Promise.reject(new HttpError(400, "Action bad request")),
          customError: Promise.reject(
            new CustomError("Action custom error", "Action custom detail"),
          ),
        },
      },
    };
    const serializedHydrationData = JSON.parse(
      serialize(
        await serializeHydrationData(hydrationData, { serializeError }),
        { isJSON: true },
      ),
    );
    deserializedHydrationData = deserializeHydrationData(
      serializedHydrationData,
      { deserializeError },
    );
  });

  it("hydrationData keys are the same", () => {
    assertEquals(
      Object.keys(deserializedHydrationData),
      ["serializedContext", "matches", "errors", "loaderData", "actionData"],
    );
  });

  it("matches are the same", () => {
    assertEquals(deserializedHydrationData.matches, hydrationData.matches);
  });

  it("serializedContext is the same", () => {
    assertEquals(
      deserializedHydrationData.serializedContext,
      hydrationData.serializedContext,
    );
  });

  it("errors are the same", () => {
    assertIsError(deserializedHydrationData.errors!["/"], Error, "Oops");
    assertIsError(
      deserializedHydrationData.errors!["/blog"],
      TypeError,
      "Wrong type",
    );

    assertIsError(
      deserializedHydrationData.errors!["/blog/index"],
      HttpError,
      "Bad request",
    );
    assertEquals(
      deserializedHydrationData.errors!["/blog/index"].name,
      "BadRequestError",
    );
    assertEquals(deserializedHydrationData.errors!["/blog/index"].status, 400);
  });

  async function assertRouteDataErrors(
    messagePrefix: string,
    routeData: HydrationData["loaderData"] | HydrationData["actionData"],
  ) {
    await assertRejects(
      () => routeData!["/blog"].error,
      Error,
      `${messagePrefix} failed`,
    );

    await assertRejects(
      () => routeData!["/blog"].typeError,
      TypeError,
      `${messagePrefix} wrong type`,
    );

    const httpError = await assertRejects(
      () => routeData!["/blog"].httpError,
      HttpError,
      `${messagePrefix} bad request`,
    );
    assertEquals(httpError.name, "BadRequestError");
    assertEquals(httpError.status, 400);

    const customError = await assertRejects(
      () => routeData!["/blog"].customError,
      CustomError,
      `${messagePrefix} custom error`,
    );
    assertEquals(customError.name, "CustomError");
    assertEquals(customError.detail, `${messagePrefix} custom detail`);
  }

  it("loaderData is the same", async () => {
    await assertRouteDataErrors("Loader", deserializedHydrationData.loaderData);
  });

  it("actionData is the same", async () => {
    await assertRouteDataErrors("Action", deserializedHydrationData.actionData);
  });
});
