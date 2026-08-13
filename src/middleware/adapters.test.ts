import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createContext, RouterContextProvider } from "react-router";
import { redirect } from "react-router";

import {
  adaptRemixLoader,
  adaptRemixAction,
  createAuthMiddleware,
  createLoggingMiddleware,
  adaptExpressMiddleware,
  createErrorHandlerMiddleware,
  createSecurityHeadersMiddleware,
  composeMiddleware,
  when,
  adaptFunction,
} from "./adapters.ts";
import type { RouteMiddlewareArgs } from "../mod.ts";

describe("Middleware Adapters", () => {
  describe("adaptRemixLoader", () => {
    it("should adapt Remix loader to middleware", async () => {
      let loaderCalled = false;
      
      const remixLoader = async ({ request }: { request: Request }) => {
        loaderCalled = true;
        return { data: "test" };
      };

      const middleware = adaptRemixLoader(remixLoader);
      const context = new RouterContextProvider();
      const request = new Request("http://localhost/test");
      
      let nextCalled = false;
      const next = async () => {
        nextCalled = true;
        return "next-result";
      };

      const result = await middleware(
        { request, params: {}, context, url: new URL(request.url), pattern: "/test" },
        next
      );

      assertEquals(loaderCalled, true);
      assertEquals(nextCalled, true);
      assertEquals(result, "next-result");
    });

    it("should throw Response from loader", async () => {
      const remixLoader = async () => {
        return new Response("Redirect", { status: 302, headers: { Location: "/login" } });
      };

      const middleware = adaptRemixLoader(remixLoader);
      const context = new RouterContextProvider();
      const request = new Request("http://localhost/test");
      
      await assertRejects(
        () => middleware(
          { request, params: {}, context, url: new URL(request.url), pattern: "/test" },
          async () => {}
        ),
        Response
      );
    });
  });

  describe("createAuthMiddleware", () => {
    it("should allow authenticated requests", async () => {
      const auth = createAuthMiddleware({
        getUser: async () => ({ id: "123", name: "Test User" }),
      });

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/protected");
      let nextCalled = false;

      await auth(
        { request, params: {}, context, url: new URL(request.url), pattern: "/protected" },
        async () => {
          nextCalled = true;
        }
      );

      assertEquals(nextCalled, true);
    });

    it("should redirect unauthenticated requests", async () => {
      const auth = createAuthMiddleware({
        getUser: async () => null,
        redirectTo: "/login",
      });

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/protected");

      await assertRejects(
        () => auth(
          { request, params: {}, context, url: new URL(request.url), pattern: "/protected" },
          async () => {}
        ),
        Response
      );
    });

    it("should skip excluded paths", async () => {
      const auth = createAuthMiddleware({
        getUser: async () => null,
        excludePaths: ["/public", "/api/health"],
      });

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/public/info");
      let nextCalled = false;

      await auth(
        { request, params: {}, context, url: new URL(request.url), pattern: "/public/*" },
        async () => {
          nextCalled = true;
        }
      );

      assertEquals(nextCalled, true);
    });

    it("should set user in context", async () => {
      const userContext = createContext<{ id: string } | null>(null);
      
      const auth = createAuthMiddleware({
        getUser: async () => ({ id: "123" }),
        contextKey: userContext,
      });

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/protected");

      await auth(
        { request, params: {}, context, url: new URL(request.url), pattern: "/protected" },
        async () => {}
      );

      assertEquals(context.get(userContext), { id: "123" });
    });
  });

  describe("createLoggingMiddleware", () => {
    it("should log requests", async () => {
      const logs: string[] = [];
      
      const logging = createLoggingMiddleware({
        logRequest: true,
        logger: (msg) => logs.push(msg),
      });

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/test");

      await logging(
        { request, params: {}, context, url: new URL(request.url), pattern: "/test" },
        async () => {}
      );

      assertEquals(logs.length > 0, true);
      assertEquals(logs[0].includes("GET"), true);
    });

    it("should log timing", async () => {
      const logs: string[] = [];
      
      const logging = createLoggingMiddleware({
        logTiming: true,
        logger: (msg) => logs.push(msg),
      });

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/test");

      await logging(
        { request, params: {}, context, url: new URL(request.url), pattern: "/test" },
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      );

      assertEquals(logs.some(log => log.includes("ms")), true);
    });
  });

  describe("composeMiddleware", () => {
    it("should compose multiple middleware", async () => {
      const order: string[] = [];

      const mw1 = async (_: unknown, next: () => Promise<unknown>) => {
        order.push("mw1-before");
        await next();
        order.push("mw1-after");
      };

      const mw2 = async (_: unknown, next: () => Promise<unknown>) => {
        order.push("mw2-before");
        await next();
        order.push("mw2-after");
      };

      const composed = composeMiddleware(mw1, mw2);

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/test");

      await composed(
        { request, params: {}, context, url: new URL(request.url), pattern: "/test" },
        async () => {
          order.push("handler");
        }
      );

      assertEquals(order, [
        "mw1-before",
        "mw2-before",
        "handler",
        "mw2-after",
        "mw1-after",
      ]);
    });
  });

  describe("when", () => {
    it("should run middleware when predicate is true", async () => {
      let mwCalled = false;
      
      const mw = async (_: unknown, next: () => Promise<unknown>) => {
        mwCalled = true;
        return next();
      };

      const conditional = when(
        ({ url }) => url?.pathname.startsWith("/admin") ?? false,
        mw
      );

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/admin/users");

      await conditional(
        { request, params: {}, context, url: new URL(request.url), pattern: "/admin/*" },
        async () => {}
      );

      assertEquals(mwCalled, true);
    });

    it("should skip middleware when predicate is false", async () => {
      let mwCalled = false;
      
      const mw = async (_: unknown, next: () => Promise<unknown>) => {
        mwCalled = true;
        return next();
      };

      const conditional = when(
        ({ url }) => url?.pathname.startsWith("/admin") ?? false,
        mw
      );

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/public");

      await conditional(
        { request, params: {}, context, url: new URL(request.url), pattern: "/public" },
        async () => {}
      );

      assertEquals(mwCalled, false);
    });
  });

  describe("adaptFunction", () => {
    it("should adapt simple function to middleware", async () => {
      let fnCalled = false;
      
      const fn = async ({ request }: RouteMiddlewareArgs) => {
        fnCalled = true;
        assertEquals(request.url, "http://localhost/test");
      };

      const middleware = adaptFunction(fn);

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/test");
      let nextCalled = false;

      await middleware(
        { request, params: {}, context, url: new URL(request.url), pattern: "/test" },
        async () => {
          nextCalled = true;
        }
      );

      assertEquals(fnCalled, true);
      assertEquals(nextCalled, true);
    });
  });

  describe("createErrorHandlerMiddleware", () => {
    it("should catch and handle errors", async () => {
      let errorHandled = false;
      
      const errorHandler = createErrorHandlerMiddleware({
        onError: (error) => {
          errorHandled = true;
          return new Response("Error handled", { status: 500 });
        },
      });

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/test");

      await assertRejects(
        () => errorHandler(
          { request, params: {}, context, url: new URL(request.url), pattern: "/test" },
          async () => {
            throw new Error("Test error");
          }
        ),
        Response
      );

      assertEquals(errorHandled, true);
    });
  });

  describe("createSecurityHeadersMiddleware", () => {
    it("should add security headers", async () => {
      const security = createSecurityHeadersMiddleware({
        contentSecurityPolicy: "default-src 'self'",
        xFrameOptions: "DENY",
      });

      const context = new RouterContextProvider();
      const request = new Request("http://localhost/test");

      const result = await security(
        { request, params: {}, context, url: new URL(request.url), pattern: "/test" },
        async () => new Response("OK")
      );

      assertEquals(result instanceof Response, true);
      if (result instanceof Response) {
        assertEquals(result.headers.get("Content-Security-Policy"), "default-src 'self'");
        assertEquals(result.headers.get("X-Frame-Options"), "DENY");
      }
    });
  });
});
