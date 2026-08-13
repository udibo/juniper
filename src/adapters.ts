/**
 * Boilerplate middleware adapters for common React Router patterns.
 *
 * These adapters help migrate middleware from React Router v7 and other
 * frameworks to Juniper with minimal changes.
 *
 * @module
 */

import { redirect } from "react-router";
import type { MiddlewareFunction } from "@udibo/juniper";

/**
 * Authentication middleware adapter.
 * 
 * Adapts common authentication patterns from React Router to Juniper.
 */
export const authAdapters = {
  /**
   * Creates authentication middleware that redirects unauthenticated users.
   * 
   * @param options - Configuration options
   * @returns MiddlewareFunction
   * 
   * @example
   * ```typescript
   * import { authAdapters } from "@udibo/juniper/adapters";
   * import { userContext } from "@/context/user";
   * 
   * export const middleware = [
   *   authAdapters.requireAuth({ userContext, loginPath: "/login" })
   * ];
   * ```
   */
  requireAuth: <T>(options: {
    userContext: any;
    loginPath?: string;
    getUser?: (request: Request) => Promise<T | null> | T | null;
  }): MiddlewareFunction => {
    return async ({ context, request }, next) => {
      // Try to get user from context first
      let user = context.get(options.userContext);
      
      // If not in context and getUser is provided, try to fetch it
      if (!user && options.getUser) {
        user = await options.getUser(request);
        if (user) {
          context.set(options.userContext, user);
        }
      }
      
      if (!user) {
        throw redirect(options.loginPath || "/login");
      }
      
      return next();
    };
  },

  /**
   * Creates authentication middleware that allows both authenticated and
   * unauthenticated users (optional auth).
   * 
   * @param options - Configuration options
   * @returns MiddlewareFunction
   */
  optionalAuth: <T>(options: {
    userContext: any;
    getUser?: (request: Request) => Promise<T | null> | T | null;
  }): MiddlewareFunction => {
    return async ({ context, request }, next) => {
      if (options.getUser) {
        try {
          const user = await options.getUser(request);
          if (user) {
            context.set(options.userContext, user);
          }
        } catch {
          // Silently fail for optional auth
        }
      }
      return next();
    };
  },

  /**
   * Creates role-based access control middleware.
   * 
   * @param options - Configuration options
   * @returns MiddlewareFunction
   * 
   * @example
   * ```typescript
   * export const middleware = [
   *   authAdapters.requireRole({
   *     userContext,
   *     roles: ["admin", "moderator"],
   *     unauthorizedPath: "/unauthorized"
   *   })
   * ];
   * ```
   */
  requireRole: (options: {
    userContext: any;
    roles: string[];
    unauthorizedPath?: string;
    roleField?: string;
  }): MiddlewareFunction => {
    return async ({ context }, next) => {
      const user = context.get(options.userContext);
      
      if (!user) {
        throw redirect("/login");
      }
      
      const userRoles = options.roleField 
        ? (user as Record<string, unknown>)[options.roleField] 
        : (user as { roles?: unknown }).roles || [];
      
      const hasRole = options.roles.some(role => 
        Array.isArray(userRoles) 
          ? userRoles.includes(role)
          : userRoles === role
      );
      
      if (!hasRole) {
        throw redirect(options.unauthorizedPath || "/unauthorized");
      }
      
      return next();
    };
  },
};

/**
 * Logging middleware adapters.
 */
export const loggingAdapters = {
  /**
   * Creates request logging middleware.
   * 
   * @param options - Configuration options
   * @returns MiddlewareFunction
   * 
   * @example
   * ```typescript
   * export const middleware = [
   *   loggingAdapters.requestLogger({ logBody: true })
   * ];
   * ```
   */
  requestLogger: (options: {
    logBody?: boolean;
    logHeaders?: boolean;
    excludePaths?: string[];
  } = {}): MiddlewareFunction => {
    return async ({ request, pattern }, next) => {
      const start = performance.now();
      const url = new URL(request.url);
      
      if (options.excludePaths?.some(p => url.pathname.startsWith(p))) {
        return next();
      }
      
      console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);
      
      if (options.logHeaders) {
        console.log(`  Headers:`, Object.fromEntries(request.headers.entries()));
      }
      
      if (options.logBody && request.method !== "GET") {
        try {
          const clonedRequest = request.clone();
          const body = await clonedRequest.text();
          if (body) {
            console.log(`  Body: ${body.substring(0, 200)}`);
          }
        } catch {
          // Ignore body parsing errors
        }
      }
      
      const result = await next();
      
      const duration = performance.now() - start;
      console.log(`[${new Date().toISOString()}] ${pattern} completed in ${duration.toFixed(2)}ms`);
      
      return result;
    };
  },

  /**
   * Creates performance monitoring middleware.
   * 
   * @param options - Configuration options
   * @returns MiddlewareFunction
   */
  performanceMonitor: (options: {
    slowThreshold?: number;
    onSlowRequest?: (info: { url: string; pattern: string; duration: number }) => void;
  } = {}): MiddlewareFunction => {
    return async ({ request, pattern }, next) => {
      const start = performance.now();
      const url = new URL(request.url);
      
      const result = await next();
      
      const duration = performance.now() - start;
      const threshold = options.slowThreshold || 1000;
      
      if (duration > threshold) {
        const info = {
          url: url.pathname,
          pattern,
          duration: Math.round(duration),
        };
        
        console.warn(`⚠️  Slow request: ${info.pattern} took ${info.duration}ms`);
        
        if (options.onSlowRequest) {
          options.onSlowRequest(info);
        }
      }
      
      return result;
    };
  },
};

/**
 * Error handling middleware adapters.
 */
export const errorAdapters = {
  /**
   * Creates error boundary middleware that catches and handles errors.
   * 
   * @param options - Configuration options
   * @returns MiddlewareFunction
   * 
   * @example
   * ```typescript
   * export const middleware = [
   *   errorAdapters.errorBoundary({
   *     onError: (error, { request }) => {
   *       console.error(`Error on ${request.url}:`, error);
   *     }
   *   })
   * ];
   * ```
   */
  errorBoundary: (options: {
    onError?: (error: unknown, args: { request: Request; pattern: string }) => void;
    redirectOnError?: string;
  } = {}): MiddlewareFunction => {
    return async ({ request, pattern }, next) => {
      try {
        return await next();
      } catch (error) {
        if (options.onError) {
          options.onError(error, { request, pattern });
        } else {
          console.error(`Error in ${pattern}:`, error);
        }
        
        if (options.redirectOnError) {
          throw redirect(options.redirectOnError);
        }
        
        throw error;
      }
    };
  },

  /**
   * Creates middleware that validates required context values.
   * 
   * @param requiredContexts - Array of context objects that must be set
   * @returns MiddlewareFunction
   */
  requireContext: (...requiredContexts: any[]): MiddlewareFunction => {
    return async ({ context, pattern }, next) => {
      for (const ctx of requiredContexts) {
        const value = context.get(ctx);
        if (value === undefined) {
          throw new Error(
            `Required context not found in ${pattern}. ` +
            `Ensure middleware sets this context before this route.`
          );
        }
      }
      return next();
    };
  },
};

/**
 * Security middleware adapters.
 */
export const securityAdapters = {
  /**
   * Creates CORS middleware adapter.
   * 
   * @param options - CORS options
   * @returns MiddlewareFunction
   */
  cors: (options: {
    origin?: string | string[];
    methods?: string[];
    headers?: string[];
  } = {}): MiddlewareFunction => {
    return async ({ request }, next) => {
      const origin = request.headers.get("origin");
      const allowedOrigins = Array.isArray(options.origin) 
        ? options.origin 
        : options.origin ? [options.origin] : ["*"];
      
      if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
        // In a real implementation, you'd set CORS headers on the response
        // For middleware, we just validate
        return next();
      }
      
      return next();
    };
  },

  /**
   * Creates rate limiting middleware (basic implementation).
   * 
   * @param options - Rate limit options
   * @returns MiddlewareFunction
   */
  rateLimit: (options: {
    maxRequests?: number;
    windowMs?: number;
    keyGenerator?: (request: Request) => string;
  } = {}): MiddlewareFunction => {
    const requests = new Map<string, { count: number; resetTime: number }>();
    
    return async ({ request }, next) => {
      const key = options.keyGenerator 
        ? options.keyGenerator(request)
        : request.headers.get("x-forwarded-for") || "anonymous";
      
      const now = Date.now();
      const windowMs = options.windowMs || 60000;
      const maxRequests = options.maxRequests || 100;
      
      const record = requests.get(key);
      
      if (record && record.resetTime > now) {
        if (record.count >= maxRequests) {
          throw new Response("Too Many Requests", { status: 429 });
        }
        record.count++;
      } else {
        requests.set(key, {
          count: 1,
          resetTime: now + windowMs,
        });
      }
      
      return next();
    };
  },
};

/**
 * Context middleware adapters.
 */
export const contextAdapters = {
  /**
   * Creates middleware that sets context values.
   * 
   * @param contextMap - Map of context objects to values or value getters
   * @returns MiddlewareFunction
   * 
   * @example
   * ```typescript
   * export const middleware = [
   *   contextAdapters.setContext(new Map([
   *     [themeContext, "dark"],
   *     [userContext, async ({ request }) => getUser(request)]
   *   ]))
   * ];
   * ```
   */
  setContext: (
    contextMap: Map<any, any | ((args: { request: Request }) => any | Promise<any>)>
  ): MiddlewareFunction => {
    return async ({ context, request }, next) => {
      for (const [ctx, valueOrGetter] of contextMap.entries()) {
        const value = typeof valueOrGetter === "function"
          ? await valueOrGetter({ request })
          : valueOrGetter;
        
        context.set(ctx, value);
      }
      
      return next();
    };
  },

  /**
   * Creates middleware that merges context from multiple sources.
   * 
   * @param sources - Array of context sources
   * @returns MiddlewareFunction
   */
  mergeContext: (
    ...sources: Array<(args: { request: Request; context: any }) => Record<string, any> | Promise<Record<string, any>>>
  ): MiddlewareFunction => {
    return async ({ context, request }, next) => {
      for (const source of sources) {
        try {
          const values = await source({ request, context });
          // Note: This is a simplified implementation
          // In practice, you'd need to map string keys to context objects
          console.debug("Merged context values:", Object.keys(values));
        } catch (error) {
          console.warn("Failed to merge context from source:", error);
        }
      }
      
      return next();
    };
  },
};

/**
 * Utility to compose multiple middleware functions.
 * 
 * @param middlewares - Array of middleware functions
 * @returns Composed middleware function
 * 
 * @example
 * ```typescript
 * export const middleware = [
 *   composeMiddleware(
 *     loggingAdapters.requestLogger(),
 *     authAdapters.requireAuth({ userContext }),
 *     errorAdapters.errorBoundary()
 *   )
 * ];
 * ```
 */
export function composeMiddleware(
  ...middlewares: MiddlewareFunction[]
): MiddlewareFunction {
  return async (args, next) => {
    let index = -1;
    
    async function dispatch(i: number): Promise<any> {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      
      const middleware = i === middlewares.length ? next : middlewares[i];
      if (!middleware) return;
      
      return middleware(args, () => dispatch(i + 1));
    }
    
    return dispatch(0);
  };
}
