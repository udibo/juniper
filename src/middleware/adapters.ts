/**
 * Middleware adapters for compatibility with various React Router ecosystems.
 *
 * These adapters allow you to use middleware from Remix, React Router v6/v7,
 * and other popular libraries with minimal changes in Juniper.
 *
 * @module
 */

import type {
  MiddlewareFunction,
  RouteMiddlewareArgs,
} from "../mod.ts";
import { redirect } from "react-router";

/**
 * A generic middleware adapter that converts between different middleware signatures.
 */
export type MiddlewareAdapter<TArgs = unknown, TResult = unknown> = (
  fn: (args: TArgs, next: () => Promise<TResult>) => Promise<TResult> | TResult,
) => MiddlewareFunction;

/**
 * Adapts Remix-style middleware to Juniper/React Router v7 format.
 *
 * Remix middleware (pre-v2) had a different signature. This adapter helps
 * migrate Remix apps to Juniper.
 *
 * @example
 * ```typescript
 * // Remix middleware
 * export async function loader({ request, context }) {
 *   // Remix loader logic
 * }
 *
 * // Adapted for Juniper
 * import { adaptRemixLoader } from "@udibo/juniper/middleware/adapters";
 *
 * export const middleware = [
 *   adaptRemixLoader(remixLoader)
 * ];
 * ```
 */
export function adaptRemixLoader(
  loader: (args: {
    request: Request;
    params: Record<string, string>;
    context: unknown;
  }) => Promise<unknown> | unknown,
): MiddlewareFunction {
  return async ({ request, params, context }, next) => {
    // Remix loaders receive context directly, not via RouterContextProvider
    // We adapt by passing the context object
    const result = await loader({ request, params, context });
    
    // If loader returns a Response or redirect, handle it
    if (result instanceof Response) {
      throw result;
    }
    
    return next();
  };
}

/**
 * Adapts Remix action to middleware.
 */
export function adaptRemixAction(
  action: (args: {
    request: Request;
    params: Record<string, string>;
    context: unknown;
  }) => Promise<unknown> | unknown,
): MiddlewareFunction {
  return async ({ request, params, context }, next) => {
    if (request.method !== "GET") {
      const result = await action({ request, params, context });
      if (result instanceof Response) {
        throw result;
      }
    }
    return next();
  };
}

/**
 * Creates an authentication middleware that works with various auth patterns.
 *
 * @example
 * ```typescript
 * import { createAuthMiddleware } from "@udibo/juniper/middleware/adapters";
 *
 * const auth = createAuthMiddleware({
 *   getUser: async (request) => {
 *     const token = request.headers.get("Authorization");
 *     return token ? await verifyToken(token) : null;
 *   },
 *   onUnauthorized: () => redirect("/login"),
 *   contextKey: userContext,
 * });
 *
 * export const middleware = [auth];
 * ```
 */
export function createAuthMiddleware<TUser = unknown>(options: {
  getUser: (request: Request) => Promise<TUser | null> | TUser | null;
  onUnauthorized?: () => Response | never;
  redirectTo?: string;
  contextKey?: unknown;
  excludePaths?: string[];
}): MiddlewareFunction {
  return async ({ request, context, url }, next) => {
    // Check if path is excluded
    if (options.excludePaths) {
      const pathname = url?.pathname || new URL(request.url).pathname;
      if (options.excludePaths.some(pattern => 
        pathname.startsWith(pattern) || new RegExp(pattern).test(pathname)
      )) {
        return next();
      }
    }

    const user = await options.getUser(request);
    
    if (!user) {
      if (options.onUnauthorized) {
        throw options.onUnauthorized();
      }
      if (options.redirectTo) {
        throw redirect(options.redirectTo);
      }
      throw redirect("/login");
    }

    // Set user in context if contextKey provided
    if (options.contextKey && context && typeof context === "object" && "set" in context) {
      (context as { set: (key: unknown, value: unknown) => void }).set(
        options.contextKey,
        user
      );
    }

    return next();
  };
}

/**
 * Creates a logging middleware compatible with various logging patterns.
 *
 * @example
 * ```typescript
 * import { createLoggingMiddleware } from "@udibo/juniper/middleware/adapters";
 *
 * export const middleware = [
 *   createLoggingMiddleware({
 *     logRequest: true,
 *     logResponse: true,
 *     logTiming: true,
 *   })
 * ];
 * ```
 */
export function createLoggingMiddleware(options: {
  logRequest?: boolean;
  logResponse?: boolean;
  logTiming?: boolean;
  logger?: (message: string, data?: unknown) => void;
  format?: (info: {
    method: string;
    url: string;
    duration?: number;
    status?: number;
  }) => string;
} = {}): MiddlewareFunction {
  const logger = options.logger || console.log;
  const format = options.format || (({ method, url, duration, status }) => {
    const base = `${method} ${url}`;
    if (duration !== undefined) {
      return `${base} - ${duration}ms${status ? ` [${status}]` : ""}`;
    }
    return base;
  });

  return async ({ request, url }, next) => {
    const start = performance.now();
    const method = request.method;
    const requestUrl = url?.toString() || request.url;

    if (options.logRequest) {
      logger(`→ ${format({ method, url: requestUrl })}`);
    }

    try {
      const result = await next();
      const duration = Math.round(performance.now() - start);

      if (options.logResponse || options.logTiming) {
        logger(`← ${format({ method, url: requestUrl, duration })}`);
      }

      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      logger(`✗ ${format({ method, url: requestUrl, duration })} - Error: ${error}`);
      throw error;
    }
  };
}

/**
 * Adapts Express-style middleware to React Router middleware.
 *
 * Express middleware uses (req, res, next) signature.
 * This adapter converts it to React Router format.
 *
 * @example
 * ```typescript
 * import { adaptExpressMiddleware } from "@udibo/juniper/middleware/adapters";
 * import cors from "cors";
 *
 * // Adapt Express cors middleware
 * export const middleware = [
 *   adaptExpressMiddleware(cors())
 * ];
 * ```
 */
export function adaptExpressMiddleware(
  expressMiddleware: (
    req: Request,
    res: { headers: Headers; status: (code: number) => void },
    next: (err?: unknown) => void
  ) => void | Promise<void>
): MiddlewareFunction {
  return async ({ request }, next) => {
    return new Promise((resolve, reject) => {
      const res = {
        headers: new Headers(),
        status: (_code: number) => {},
      };

      const expressNext = (err?: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve(next());
        }
      };

      try {
        const result = expressMiddleware(request, res, expressNext);
        if (result instanceof Promise) {
          result.catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  };
}

/**
 * Creates a middleware that handles errors and converts them to responses.
 *
 * @example
 * ```typescript
 * import { createErrorHandlerMiddleware } from "@udibo/juniper/middleware/adapters";
 *
 * export const middleware = [
 *   createErrorHandlerMiddleware({
 *     onError: (error, { request }) => {
 *       console.error(`Error handling ${request.url}:`, error);
 *       return new Response("Internal Server Error", { status: 500 });
 *     }
 *   })
 * ];
 * ```
 */
export function createErrorHandlerMiddleware(options: {
  onError?: (error: unknown, args: RouteMiddlewareArgs) => Response | Promise<Response> | void;
  logErrors?: boolean;
}): MiddlewareFunction {
  return async (args, next) => {
    try {
      return await next();
    } catch (error) {
      if (options.logErrors !== false) {
        console.error("Middleware error:", error);
      }

      if (options.onError) {
        const response = await options.onError(error, args);
        if (response instanceof Response) {
          throw response;
        }
      }

      throw error;
    }
  };
}

/**
 * Creates a middleware that adds security headers.
 *
 * @example
 * ```typescript
 * import { createSecurityHeadersMiddleware } from "@udibo/juniper/middleware/adapters";
 *
 * export const middleware = [
 *   createSecurityHeadersMiddleware({
 *     contentSecurityPolicy: "default-src 'self'",
 *     strictTransportSecurity: true,
 *   })
 * ];
 * ```
 */
export function createSecurityHeadersMiddleware(options: {
  contentSecurityPolicy?: string;
  strictTransportSecurity?: boolean | string;
  xFrameOptions?: string;
  xContentTypeOptions?: boolean;
  referrerPolicy?: string;
} = {}): MiddlewareFunction {
  return async ({ request }, next) => {
    const result = await next();
    
    // In a real implementation, you'd modify the response headers
    // For now, this is a placeholder that shows the pattern
    if (result instanceof Response) {
      const headers = new Headers(result.headers);
      
      if (options.contentSecurityPolicy) {
        headers.set("Content-Security-Policy", options.contentSecurityPolicy);
      }
      
      if (options.strictTransportSecurity) {
        const value = typeof options.strictTransportSecurity === "string" 
          ? options.strictTransportSecurity 
          : "max-age=31536000; includeSubDomains";
        headers.set("Strict-Transport-Security", value);
      }
      
      if (options.xFrameOptions) {
        headers.set("X-Frame-Options", options.xFrameOptions);
      }
      
      if (options.xContentTypeOptions) {
        headers.set("X-Content-Type-Options", "nosniff");
      }
      
      if (options.referrerPolicy) {
        headers.set("Referrer-Policy", options.referrerPolicy);
      }

      return new Response(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers,
      });
    }
    
    return result;
  };
}

/**
 * Composes multiple middleware functions into a single middleware.
 *
 * @example
 * ```typescript
 * import { composeMiddleware, createAuthMiddleware, createLoggingMiddleware } from "@udibo/juniper/middleware/adapters";
 *
 * export const middleware = [
 *   composeMiddleware(
 *     createLoggingMiddleware(),
 *     createAuthMiddleware({ 
 *       // ... config
 *     }),
 *   )
 * ];
 * ```
 */
export function composeMiddleware(...middlewares: MiddlewareFunction[]): MiddlewareFunction {
  return async (args, next) => {
    let index = -1;
    
    async function dispatch(i: number): Promise<unknown> {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      
      const fn = i === middlewares.length ? next : middlewares[i];
      if (!fn) return;
      
      return fn(args, () => dispatch(i + 1));
    }
    
    return dispatch(0);
  };
}

/**
 * Creates a conditional middleware that only runs when a predicate is true.
 *
 * @example
 * ```typescript
 * import { when, createAuthMiddleware } from "@udibo/juniper/middleware/adapters";
 *
 * export const middleware = [
 *   when(
 *     ({ url }) => url?.pathname.startsWith("/admin") ?? false,
 *     createAuthMiddleware({
 *       // ... config
 *     })
 *   )
 * ];
 * ```
 */
export function when(
  predicate: (args: RouteMiddlewareArgs) => boolean | Promise<boolean>,
  middleware: MiddlewareFunction
): MiddlewareFunction {
  return async (args, next) => {
    const shouldRun = await predicate(args);
    if (shouldRun) {
      return middleware(args, next);
    }
    return next();
  };
}

/**
 * Adapts a simple async function to middleware format.
 *
 * @example
 * ```typescript
 * import { adaptFunction } from "@udibo/juniper/middleware/adapters";
 *
 * // Simple function
 * async function myLogic({ request, context }) {
 *   context.set("data", await fetchData());
 * }
 *
 * export const middleware = [adaptFunction(myLogic)];
 * ```
 */
export function adaptFunction(
  fn: (args: RouteMiddlewareArgs) => Promise<void> | void
): MiddlewareFunction {
  return async (args, next) => {
    await fn(args);
    return next();
  };
}
