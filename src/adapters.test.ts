import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createContext } from "react-router";

import {
  authAdapters,
  loggingAdapters,
  errorAdapters,
  securityAdapters,
  contextAdapters,
  composeMiddleware,
} from "./adapters.ts";

describe("Middleware Adapters", () => {
  describe("authAdapters", () => {
    describe("requireAuth", () => {
      it("should allow authenticated users", async () => {
        const userContext = createContext<{ id: string } | null>(null);
        const middleware = authAdapters.requireAuth({
          userContext,
        });

        const mockContext = {
          get: () => ({ id: "123", name: "Test User" }),
          set: () => {},
        };
        
        const mockRequest = new Request("http://localhost/dashboard");
        let nextCalled = false;

        await middleware(
          {
            context: mockContext as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/dashboard",
          },
          async () => {
            nextCalled = true;
          }
        );

        assertEquals(nextCalled, true);
      });

      it("should redirect unauthenticated users", async () => {
        const userContext = createContext(null);
        const middleware = authAdapters.requireAuth({
          userContext,
          loginPath: "/login",
        });

        const mockContext = {
          get: () => null,
          set: () => {},
        };

        const mockRequest = new Request("http://localhost/dashboard");
        let errorThrown = false;

        try {
          await middleware(
            {
              context: mockContext as any,
              request: mockRequest,
              params: {},
              url: new URL(mockRequest.url),
              pattern: "/dashboard",
            },
            async () => {}
          );
        } catch (error) {
          errorThrown = true;
          // React Router redirects throw Response objects
          assertExists(error);
        }

        assertEquals(errorThrown, true);
      });

      it("should fetch user with getUser function", async () => {
        const userContext = createContext(null);
        const middleware = authAdapters.requireAuth({
          userContext,
          getUser: async () => ({ id: "123", name: "Fetched User" }),
        });

        let setCalled = false;
        const mockContext = {
          get: () => null,
          set: () => {
            setCalled = true;
          },
        };

        const mockRequest = new Request("http://localhost/dashboard");
        let nextCalled = false;

        await middleware(
          {
            context: mockContext as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/dashboard",
          },
          async () => {
            nextCalled = true;
          }
        );

        assertEquals(setCalled, true);
        assertEquals(nextCalled, true);
      });
    });

    describe("optionalAuth", () => {
      it("should continue without user", async () => {
        const userContext = createContext(null);
        const middleware = authAdapters.optionalAuth({
          userContext,
        });

        const mockContext = {
          get: () => null,
          set: () => {},
        };

        const mockRequest = new Request("http://localhost/");
        let nextCalled = false;

        await middleware(
          {
            context: mockContext as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/",
          },
          async () => {
            nextCalled = true;
          }
        );

        assertEquals(nextCalled, true);
      });
    });

    describe("requireRole", () => {
      it("should allow users with required role", async () => {
        const userContext = createContext(null);
        const middleware = authAdapters.requireRole({
          userContext,
          roles: ["admin"],
        });

        const mockContext = {
          get: () => ({ id: "1", roles: ["admin", "user"] }),
          set: () => {},
        };

        const mockRequest = new Request("http://localhost/admin");
        let nextCalled = false;

        await middleware(
          {
            context: mockContext as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/admin",
          },
          async () => {
            nextCalled = true;
          }
        );

        assertEquals(nextCalled, true);
      });

      it("should reject users without required role", async () => {
        const userContext = createContext(null);
        const middleware = authAdapters.requireRole({
          userContext,
          roles: ["admin"],
        });

        const mockContext = {
          get: () => ({ id: "1", roles: ["user"] }),
          set: () => {},
        };

        const mockRequest = new Request("http://localhost/admin");
        let errorThrown = false;

        try {
          await middleware(
            {
              context: mockContext as any,
              request: mockRequest,
              params: {},
              url: new URL(mockRequest.url),
              pattern: "/admin",
            },
            async () => {}
          );
        } catch (error) {
          errorThrown = true;
        }

        assertEquals(errorThrown, true);
      });
    });
  });

  describe("loggingAdapters", () => {
    describe("requestLogger", () => {
      it("should log requests", async () => {
        const middleware = loggingAdapters.requestLogger();
        const mockRequest = new Request("http://localhost/test");
        let nextCalled = false;

        // Just verify it doesn't throw
        await middleware(
          {
            context: {} as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/test",
          },
          async () => {
            nextCalled = true;
          }
        );

        assertEquals(nextCalled, true);
      });

      it("should exclude paths", async () => {
        const middleware = loggingAdapters.requestLogger({
          excludePaths: ["/health"],
        });
        const mockRequest = new Request("http://localhost/health");
        let nextCalled = false;

        await middleware(
          {
            context: {} as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/health",
          },
          async () => {
            nextCalled = true;
          }
        );

        assertEquals(nextCalled, true);
      });
    });

    describe("performanceMonitor", () => {
      it("should monitor performance", async () => {
        const middleware = loggingAdapters.performanceMonitor({
          slowThreshold: 0, // Make everything "slow" for testing
        });
        const mockRequest = new Request("http://localhost/test");
        let nextCalled = false;

        await middleware(
          {
            context: {} as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/test",
          },
          async () => {
            nextCalled = true;
          }
        );

        assertEquals(nextCalled, true);
      });
    });
  });

  describe("errorAdapters", () => {
    describe("errorBoundary", () => {
      it("should catch errors", async () => {
        let errorCaught = false;
        const middleware = errorAdapters.errorBoundary({
          onError: () => {
            errorCaught = true;
          },
        });
        const mockRequest = new Request("http://localhost/test");

        try {
          await middleware(
            {
              context: {} as any,
              request: mockRequest,
              params: {},
              url: new URL(mockRequest.url),
              pattern: "/test",
            },
            async () => {
              throw new Error("Test error");
            }
          );
        } catch {
          // Expected to re-throw
        }

        assertEquals(errorCaught, true);
      });
    });

    describe("requireContext", () => {
      it("should pass when context exists", async () => {
        const ctx1 = createContext(null);
        const middleware = errorAdapters.requireContext(ctx1);
        const mockContext = {
          get: (ctx: any) => ctx === ctx1 ? "value" : undefined,
          set: () => {},
        };
        const mockRequest = new Request("http://localhost/test");
        let nextCalled = false;

        await middleware(
          {
            context: mockContext as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/test",
          },
          async () => {
            nextCalled = true;
          }
        );

        assertEquals(nextCalled, true);
      });

      it("should throw when context missing", async () => {
        const ctx1 = createContext(null);
        const middleware = errorAdapters.requireContext(ctx1);
        const mockContext = {
          get: () => undefined,
          set: () => {},
        };
        const mockRequest = new Request("http://localhost/test");
        let errorThrown = false;

        try {
          await middleware(
            {
              context: mockContext as any,
              request: mockRequest,
              params: {},
              url: new URL(mockRequest.url),
              pattern: "/test",
            },
            async () => {}
          );
        } catch {
          errorThrown = true;
        }

        assertEquals(errorThrown, true);
      });
    });
  });

  describe("securityAdapters", () => {
    describe("rateLimit", () => {
      it("should allow requests under limit", async () => {
        const middleware = securityAdapters.rateLimit({
          maxRequests: 5,
          windowMs: 60000,
        });
        const mockRequest = new Request("http://localhost/test");
        let nextCalled = false;

        await middleware(
          {
            context: {} as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/test",
          },
          async () => {
            nextCalled = true;
          }
        );

        assertEquals(nextCalled, true);
      });
    });
  });

  describe("contextAdapters", () => {
    describe("setContext", () => {
      it("should set context values", async () => {
        const ctx1 = createContext(null);
        const middleware = contextAdapters.setContext(
          new Map([[ctx1, "test-value"]])
        );

        let setCalled = false;
        let setValue: unknown;
        const mockContext = {
          get: () => undefined,
          set: (ctx: any, value: unknown) => {
            setCalled = true;
            setValue = value;
          },
        };

        const mockRequest = new Request("http://localhost/test");
        let nextCalled = false;

        await middleware(
          {
            context: mockContext as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/test",
          },
          async () => {
            nextCalled = true;
          }
        );

        assertEquals(setCalled, true);
        assertEquals(setValue, "test-value");
        assertEquals(nextCalled, true);
      });

      it("should support async value getters", async () => {
        const ctx1 = createContext(null);
        const middleware = contextAdapters.setContext(
          new Map([
            [ctx1, async () => "async-value"]
          ])
        );

        let setCalled = false;
        const mockContext = {
          get: () => undefined,
          set: () => {
            setCalled = true;
          },
        };

        const mockRequest = new Request("http://localhost/test");

        await middleware(
          {
            context: mockContext as any,
            request: mockRequest,
            params: {},
            url: new URL(mockRequest.url),
            pattern: "/test",
          },
          async () => {}
        );

        assertEquals(setCalled, true);
      });
    });
  });

  describe("composeMiddleware", () => {
    it("should compose multiple middleware", async () => {
      const order: number[] = [];
      
      const mw1 = async (_: any, next: () => Promise<void>) => {
        order.push(1);
        await next();
        order.push(4);
      };
      
      const mw2 = async (_: any, next: () => Promise<void>) => {
        order.push(2);
        await next();
        order.push(3);
      };
      
      const composed = composeMiddleware(mw1, mw2);
      const mockRequest = new Request("http://localhost/test");

      await composed(
        {
          context: {} as any,
          request: mockRequest,
          params: {},
          url: new URL(mockRequest.url),
          pattern: "/test",
        },
        async () => {
          order.push(2.5);
        }
      );

      assertEquals(order, [1, 2, 2.5, 3, 4]);
    });
  });
});
