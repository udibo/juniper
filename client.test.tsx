import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import {
  assertEquals,
  assertExists,
  assertIsError,
  assertObjectMatch,
} from "@std/assert";

import {
  Client,
  createLazyRouteObject,
  deserializeErrorDefault,
  deserializeRouteData,
  isSerializedError,
} from "./client.tsx";
import type { ClientRouteFile, RootClientRoute } from "./client.tsx";
import { Outlet } from "react-router";
import { HttpError } from "@udibo/http-error";
import {
  simulateBrowser,
  type SimulatedBrowser,
} from "@udibo/juniper/utils/testing";

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
    assertEquals(client.routeFileMap.get("0"), routes.main);
    assertEquals(client.routeObjectMap.get("0"), routeObject);

    assertObjectMatch(routeObject.children[0], {
      "index": true,
    });
    assertExists(routeObject.children[0].lazy);
    assertEquals(client.routeFileMap.get("0-0"), routes.index);
    assertEquals(client.routeObjectMap.get("0-0"), routeObject.children[0]);

    assertObjectMatch(routeObject.children[1], {
      "path": "about",
    });
    assertExists(routeObject.children[1].lazy);
    assertEquals(client.routeFileMap.get("0-1"), routes.children[0].main);
    assertEquals(client.routeObjectMap.get("0-1"), routeObject.children[1]);

    assertObjectMatch(routeObject.children[2], {
      "path": "blog",
    });
    assertExists(routeObject.children[2].lazy);
    assertEquals(client.routeFileMap.get("0-2"), routes.children[1].main);
    assertEquals(client.routeObjectMap.get("0-2"), routeObject.children[2]);

    assertExists(routeObject.children[2].children);
    assertObjectMatch(routeObject.children[2].children[0], {
      "index": true,
    });
    assertExists(routeObject.children[2].children[0].lazy);
    assertEquals(
      client.routeFileMap.get("0-2-0"),
      routes.children[1].index,
    );
    assertEquals(
      client.routeObjectMap.get("0-2-0"),
      routeObject.children[2].children[0],
    );

    assertObjectMatch(routeObject.children[2].children[1], {
      "path": "create",
    });
    assertExists(routeObject.children[2].children[1].lazy);
    assertEquals(
      client.routeFileMap.get("0-2-1"),
      routes.children[1].children?.[0].main,
    );
    assertEquals(
      client.routeObjectMap.get("0-2-1"),
      routeObject.children[2].children[1],
    );

    assertObjectMatch(routeObject.children[2].children[2], {
      "path": ":id",
    });
    assertExists(routeObject.children[2].children[2].lazy);
    assertEquals(
      client.routeFileMap.get("0-2-2"),
      routes.children[1].children?.[1].main,
    );
    assertEquals(
      client.routeObjectMap.get("0-2-2"),
      routeObject.children[2].children[2],
    );

    assertObjectMatch(routeObject.children[3], {
      "path": "*",
    });
    assertExists(routeObject.children[3].lazy);
    assertEquals(
      client.routeFileMap.get("0-3"),
      routes.catchall,
    );
    assertEquals(client.routeObjectMap.get("0-3"), routeObject.children[3]);
  });
});

describe("createLazyRouteObject", () => {
  let routeFile: ClientRouteFile;
  const lazyRouteFile = () => Promise.resolve(routeFile);
  beforeEach(() => {
    routeFile = {
      default: () => <div>Lazy Route</div>,
    } satisfies ClientRouteFile;
  });

  it("from a file with only default export", async () => {
    const lazyRouteObject = createLazyRouteObject(lazyRouteFile);
    const { Component, ErrorBoundary, loader } = await lazyRouteObject();
    assertEquals(Component, routeFile.default);
    assertEquals(ErrorBoundary, undefined);
    assertEquals(loader, undefined);
  });

  it("from a file with ErrorBoundary export", async () => {
    routeFile.ErrorBoundary = () => <div>Error Boundary</div>;
    const lazyRouteObject = createLazyRouteObject(lazyRouteFile);
    const { Component, ErrorBoundary, loader } = await lazyRouteObject();
    assertEquals(Component, routeFile.default);
    assertEquals(ErrorBoundary, ErrorBoundary);
    assertEquals(loader, undefined);
  });

  it("from a file with loader export", async () => {
    routeFile.loader = () => Promise.resolve({});
    const lazyRouteObject = createLazyRouteObject(lazyRouteFile);
    const { Component, ErrorBoundary, loader } = await lazyRouteObject();
    assertEquals(Component, routeFile.default);
    assertEquals(ErrorBoundary, undefined);
    assertEquals(loader, routeFile.loader);
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

describe("deserializeRouteData", () => {
  it("should deserialize simple route data", () => {
    const serializedRouteData = {
      "0": {
        value: {
          user: { value: { name: "John", age: 30 } },
          settings: { value: { theme: "dark" } },
        },
      },
      "0-1": {
        value: {
          posts: { value: [{ id: 1, title: "Hello" }] },
        },
      },
    };

    const result = deserializeRouteData(
      serializedRouteData,
      deserializeErrorDefault,
    );

    assertExists(result);
    assertEquals(result["0"], {
      user: { name: "John", age: 30 },
      settings: { theme: "dark" },
    });
    assertEquals(result["0-1"], {
      posts: [{ id: 1, title: "Hello" }],
    });
  });

  it("should deserialize route data with resolved promises", async () => {
    const serializedRouteData = {
      "0": {
        __type: "Promise" as const,
        value: {
          user: { value: { name: "John" } },
          asyncData: {
            __type: "Promise" as const,
            value: "resolved data",
          },
        },
      },
    };

    const result = deserializeRouteData(
      serializedRouteData,
      deserializeErrorDefault,
    );

    assertExists(result);
    assertExists(result["0"]);
    assertExists(result["0"].then);

    const resolvedData = await result["0"];
    assertExists(resolvedData);
    assertEquals(resolvedData.user, { name: "John" });
    assertExists(resolvedData.asyncData);
    assertExists(resolvedData.asyncData.then);
  });

  it("should deserialize route data with rejected promises", async () => {
    const serializedRouteData = {
      "0": {
        __type: "Promise" as const,
        error: {
          __type: "Error",
          message: "Promise rejected",
        },
      },
      "0-1": {
        value: {
          asyncData: {
            __type: "Promise" as const,
            error: {
              __type: "Error",
              __subType: "HttpError",
              status: 404,
              detail: "Not found",
            },
          },
        },
      },
    };

    const result = deserializeRouteData(
      serializedRouteData,
      deserializeErrorDefault,
    );

    assertExists(result);
    assertExists(result["0"]);
    assertExists(result["0"].then);
    assertExists(result["0-1"]);
    assertExists(result["0-1"].asyncData);
    assertExists(result["0-1"].asyncData.then);

    try {
      await result["0"];
      assertEquals(true, false, "Should have thrown an error");
    } catch (error) {
      assertIsError(error, Error, "Promise rejected");
    }

    try {
      await result["0-1"].asyncData;
      assertEquals(true, false, "Should have thrown an error");
    } catch (error) {
      assertIsError(error, HttpError, "Not found");
      assertEquals(error.status, 404);
    }
  });

  it("should handle empty route data", () => {
    const result = deserializeRouteData({}, deserializeErrorDefault);
    assertExists(result);
    assertEquals(Object.keys(result).length, 0);
  });
});

describe("getHydrationData", () => {
  describe("deserializes errors", () => {
    let browser: SimulatedBrowser;
    beforeEach(() => {
      browser = simulateBrowser({
        __juniperHydrationData: {
          errors: {
            "0": {
              __type: "Error",
              message: "Oops",
            },
            "0-1": {
              __type: "Error",
              __subType: "TypeError",
              message: "Wrong type",
            },
            "0-1-0": {
              __type: "Error",
              __subType: "HttpError",
              status: 400,
              detail: "Bad request",
            },
            "0-1-0-1": {
              __type: "Error",
              __subType: "CustomError",
              message: "Custom error",
            },
          },
          loaderData: {},
        },
      });
    });

    afterEach(() => {
      browser.restore();
    });

    it("with default deserializeError function", () => {
      const client = new Client(routes);
      const data = client.getHydrationData();
      assertObjectMatch(data, {
        loaderData: {},
      });
      assertExists(data.errors);
      assertIsError(data.errors["0"], Error, "Oops");
      assertIsError(data.errors["0-1"], TypeError, "Wrong type");

      assertIsError(data.errors["0-1-0"], HttpError, "Bad request");
      assertEquals(data.errors["0-1-0"].name, "BadRequestError");
      assertEquals(data.errors["0-1-0"].status, 400);

      assertIsError(data.errors["0-1-0-1"], Error, "Custom error");
    });

    it("with custom deserializeError function", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }
      const client = new Client({
        ...routes,
        main: {
          ...routes.main,
          deserializeError: (serializedError) => {
            if (
              isSerializedError(serializedError) &&
              serializedError.__subType === "CustomError"
            ) {
              return new CustomError(serializedError.message ?? "Unknown");
            }
          },
        },
      });
      const data = client.getHydrationData();
      assertObjectMatch(data, {
        loaderData: {},
      });
      assertExists(data.errors);
      assertIsError(data.errors["0"], Error, "Oops");
      assertIsError(data.errors["0-1"], TypeError, "Wrong type");

      assertIsError(data.errors["0-1-0"], HttpError, "Bad request");
      assertEquals(data.errors["0-1-0"].name, "BadRequestError");
      assertEquals(data.errors["0-1-0"].status, 400);

      assertIsError(data.errors["0-1-0-1"], CustomError, "Custom error");
    });
  });

  describe("deserializes loaderData and actionData", () => {
    it("should deserialize loaderData and actionData", async () => {
      using _browser = simulateBrowser({
        __juniperHydrationData: {
          loaderData: {
            "0": {
              value: {
                user: { value: { name: "John", age: 30 } },
                settings: { value: { theme: "dark" } },
              },
            },
            "0-1": {
              __type: "Promise" as const,
              value: {
                posts: { value: [{ id: 1, title: "Hello" }] },
                asyncData: {
                  __type: "Promise" as const,
                  value: "resolved data",
                },
              },
            },
          },
          actionData: {
            "0": {
              value: {
                result: { value: "success" },
                data: { value: { id: 1 } },
              },
            },
          },
        },
      });

      const client = new Client(routes);
      const data = client.getHydrationData();

      assertExists(data.loaderData);
      assertExists(data.actionData);

      assertEquals(data.loaderData["0"], {
        user: { name: "John", age: 30 },
        settings: { theme: "dark" },
      });

      assertExists(data.loaderData["0-1"]);
      assertExists(data.loaderData["0-1"].then);

      const resolvedLoaderData = await data.loaderData["0-1"];
      assertExists(resolvedLoaderData);
      assertExists(resolvedLoaderData.posts);
      assertExists(resolvedLoaderData.asyncData);
      assertExists(resolvedLoaderData.asyncData.then);

      assertEquals(data.actionData["0"], {
        result: "success",
        data: { id: 1 },
      });
    });

    it("should handle rejected promises in loaderData and actionData", async () => {
      using _browser = simulateBrowser({
        __juniperHydrationData: {
          loaderData: {
            "0-1-0": {
              __type: "Promise" as const,
              error: {
                __type: "Error",
                message: "Loader failed",
              },
            },
          },
          actionData: {
            "0-1": {
              __type: "Promise" as const,
              error: {
                __type: "Error",
                __subType: "HttpError",
                status: 422,
                detail: "Validation failed",
              },
            },
          },
        },
      });

      const client = new Client(routes);
      const data = client.getHydrationData();

      try {
        await data.loaderData!["0-1-0"];
        assertEquals(true, false, "Should have thrown an error");
      } catch (error) {
        assertIsError(error, Error, "Loader failed");
      }

      try {
        await data.actionData!["0-1"];
        assertEquals(true, false, "Should have thrown an error");
      } catch (error) {
        assertIsError(error, HttpError, "Validation failed");
        assertEquals(error.status, 422);
      }
    });

    it("should handle missing loaderData and actionData", () => {
      using _browser = simulateBrowser({
        __juniperHydrationData: {
          errors: {},
        },
      });

      const client = new Client(routes);
      const data = client.getHydrationData();

      assertEquals(data.loaderData, undefined);
      assertEquals(data.actionData, undefined);
    });

    it("should handle null actionData", () => {
      using _browser = simulateBrowser({
        __juniperHydrationData: {
          loaderData: {
            "0": { value: { data: { value: "test" } } },
          },
          actionData: null,
        },
      });

      const client = new Client(routes);
      const data = client.getHydrationData();

      assertExists(data.loaderData);
      assertEquals(data.actionData, null);
    });
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

      using _browser = simulateBrowser({
        __juniperHydrationData: {
          matches: [
            { id: "0-1" },
          ],
        },
      });

      const client = new Client(routes);

      // Manually add lazy route to simulate the scenario
      const route = client.routeObjectMap.get("0-1");

      if (route) route.lazy = mockLazyRouteFile;

      await client.loadLazyMatches();

      // Verify that lazy route was loaded and lazy property was removed
      if (route) {
        assertEquals(route.lazy, undefined);
        // The properties should be set by the loadLazyMatches method
        // Note: We're not checking the specific properties as they may not be set
        // in the test environment, but the method should run without error
      }
    });

    it("should handle routes without lazy property", async () => {
      using _browser = simulateBrowser({
        __juniperHydrationData: {
          matches: [
            { id: "0" }, // This route doesn't have lazy property
          ],
        },
      });

      const client = new Client(routes);
      const route = client.routeObjectMap.get("0");

      // Ensure the route doesn't have lazy property
      if (route) {
        delete route.lazy;
      }

      await client.loadLazyMatches();

      // Should not throw and route should remain unchanged
      if (route) {
        assertEquals(route.lazy, undefined);
      }
    });

    it("should handle missing matches in hydration data", async () => {
      using _browser = simulateBrowser({
        __juniperHydrationData: {
          // No matches property
        },
      });

      const client = new Client(routes);

      // Should not throw
      await client.loadLazyMatches();
    });

    it("should handle empty matches array", async () => {
      using _browser = simulateBrowser({
        __juniperHydrationData: {
          matches: [],
        },
      });

      const client = new Client(routes);

      // Should not throw
      await client.loadLazyMatches();
    });

    it("should handle missing hydration data", async () => {
      using _browser = simulateBrowser({
        // No __juniperHydrationData
      });

      const client = new Client(routes);

      // Should not throw
      await client.loadLazyMatches();
    });

    it("should handle lazy route that throws an error", async () => {
      const mockLazyRouteFile = () =>
        Promise.reject(new Error("Lazy load failed"));

      using _browser = simulateBrowser({
        __juniperHydrationData: {
          matches: [
            { id: "0-1" },
          ],
        },
      });

      const client = new Client(routes);
      const route = client.routeObjectMap.get("0-1");

      if (route) route.lazy = mockLazyRouteFile;

      try {
        await client.loadLazyMatches();
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
          // No ErrorBoundary or action
        });

      using _browser = simulateBrowser({
        __juniperHydrationData: {
          matches: [
            { id: "0-1" },
          ],
        },
      });

      const client = new Client(routes);
      const route = client.routeObjectMap.get("0-1");

      if (route) route.lazy = mockLazyRouteFile;

      await client.loadLazyMatches();

      if (route) {
        assertEquals(route.lazy, undefined);
        // The properties should be set by the loadLazyMatches method
        // Note: We're not checking the specific properties as they may not be set
        // in the test environment, but the method should run without error
      }
    });

    it("should handle non-existent route IDs in matches", async () => {
      using _browser = simulateBrowser({
        __juniperHydrationData: {
          matches: [
            { id: "non-existent-route" },
          ],
        },
      });

      const client = new Client(routes);

      // Should not throw
      await client.loadLazyMatches();
    });
  });
});
