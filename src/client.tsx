/**
 * The client module for the Juniper framework. This module is meant to be used exclusively by the generated `main.tsx` file.
 *
 * @module
 */
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import type { RouteObject } from "react-router";
import type { AnyParams, RootRouteModule, RouteModule } from "@udibo/juniper";

import {
  App,
  createLazyRoute,
  createRoute,
  deserializeHydrationData,
  generateRouteId,
} from "./_client.tsx";
import type {
  DefaultContext,
  HydrationData,
  LazyRoute,
  SerializedError,
  SerializedHydrationData,
  ServerFlags,
} from "./_client.tsx";
import { env } from "./utils/_env.ts";

export type { DefaultContext, HydrationData, SerializedError, ServerFlags };

/**
 * Loads a non-root route module on demand.
 *
 * @template Context - The router context type.
 */
type RouteModuleLoader<Context extends DefaultContext = DefaultContext> = () =>
  Promise<
    RouteModule<AnyParams, unknown, unknown, Context>
  >;

/**
 * Loads the root route module on demand.
 *
 * @template Context - The router context type.
 */
type RootRouteModuleLoader<Context extends DefaultContext = DefaultContext> =
  () => Promise<
    RootRouteModule<AnyParams, unknown, unknown, Context>
  >;

/**
 * A client route definition used by the generated `main.tsx`.
 *
 * @template Context - The router context type.
 */
export interface ClientRoute<Context extends DefaultContext = DefaultContext> {
  path: string;
  /**
   * The route's module.
   * Provide a `RouteModule` directly or a lazy loader that resolves to one.
   */
  main?:
    | RouteModule<AnyParams, unknown, unknown, Context>
    | RouteModuleLoader<Context>;
  /**
   * The route's index module.
   * Must resolve to a `RouteModule`.
   */
  index?: RouteModuleLoader<Context>;
  /**
   * The route's catchall module.
   * Must resolve to a `RouteModule`.
   */
  catchall?: RouteModuleLoader<Context>;
  /**
   * Flags indicating whether the route has server-side loader/action.
   * Set by the build system when server route files export loader/action.
   */
  server?: ServerFlags;
  /**
   * Flags indicating whether the index route has server-side loader/action.
   */
  serverIndex?: ServerFlags;
  /**
   * Flags indicating whether the catchall route has server-side loader/action.
   */
  serverCatchall?: ServerFlags;
  /** The route's children. */
  children?: ClientRoute<Context>[];
}

/**
 * The root client route.
 *
 * @template Context - The router context type.
 */
export interface RootClientRoute<
  Context extends DefaultContext = DefaultContext,
> extends ClientRoute<Context> {
  /**
   * The root route's module.
   * Provide a `RootRouteModule` or lazy loader.
   */
  main?:
    | RootRouteModule<AnyParams, unknown, unknown, Context>
    | RootRouteModuleLoader<Context>;
}

/**
 * Checks if a value is a serialized error.
 *
 * @param serializedError - The value to check.
 * @returns True if the value is a serialized error, false otherwise.
 */
export function isSerializedError(
  serializedError: unknown,
): serializedError is SerializedError {
  return typeof serializedError === "object" &&
    serializedError !== null &&
    "__type" in serializedError &&
    serializedError.__type === "Error";
}

/**
 * The client for a Juniper application.
 *
 * @example Creating a client
 * ```ts
 * import { Client } from "@udibo/juniper/client";
 * import { isBrowser } from "@udibo/juniper/utils/env";
 *
 * export const client = new Client({
 *   path: "/",
 *   main: await import("./routes/main.tsx"),
 *   index: () => import("./routes/index.tsx"),
 *   children: [
 *     {
 *       path: "about",
 *       main: () => import("./routes/about.tsx"),
 *     },
 *   ],
 * });
 *
 * if (isBrowser()) {
 *   await client.hydrate();
 * }
 * ```
 *
 * @template Context - The router context type.
 * @param rootRoute - The root client route.
 * @returns A new client instance.
 */
export class Client<Context extends DefaultContext = DefaultContext> {
  /** The root client route. */
  rootRoute: RootClientRoute<Context>;
  /** A map of route ids to client routes. */
  routeFileMap: Map<
    string,
    | RouteModule<AnyParams, unknown, unknown, Context>
    | RouteModuleLoader<Context>
  >;
  /** The route objects used by React Router. */
  routeObjects: RouteObject[];
  /** A map of route object ids to route objects used by React Router. */
  routeObjectMap: Map<string, RouteObject>;

  constructor(rootRoute: RootClientRoute<Context>) {
    this.rootRoute = rootRoute;
    this.routeFileMap = new Map();
    const rootRouteId = "/";
    this.routeObjects = [{ id: rootRouteId, path: rootRoute.path }];
    this.routeObjectMap = new Map();

    const parentPathStack: string[] = ["/"];
    const routeStack: ClientRoute<Context>[] = [rootRoute];
    const routeObjectStack: RouteObject[] = [...this.routeObjects];
    while (parentPathStack.length > 0) {
      const currentPath = parentPathStack.pop()!;
      const route = routeStack.pop()!;
      const routeObject = routeObjectStack.pop()!;
      const routeId = routeObject.id!;

      if (typeof route.main === "function") {
        routeObject.lazy = createLazyRoute<Context>(
          route.main,
          route.server,
          routeId,
        );
      } else if (route.main) {
        const {
          Component,
          ErrorBoundary,
          HydrateFallback,
          loader,
          action,
        } = createRoute(route.main, route.server, routeId);
        routeObject.Component = Component;
        routeObject.ErrorBoundary = ErrorBoundary;
        routeObject.HydrateFallback = HydrateFallback;
        routeObject.loader = loader;
        routeObject.action = action;
      }

      const routeObjectChildren: RouteObject[] = [];

      if (route.index) {
        const indexRouteId = generateRouteId(currentPath, "", "index");
        const indexRouteObject = {
          id: indexRouteId,
          index: true,
          lazy: createLazyRoute<Context>(
            route.index,
            route.serverIndex,
            indexRouteId,
          ),
        };
        routeObjectChildren.push(indexRouteObject);

        this.routeFileMap.set(indexRouteId, route.index);
        this.routeObjectMap.set(indexRouteId, indexRouteObject);
      }

      if (route.children) {
        for (const childRoute of route.children) {
          const childRouteId = generateRouteId(
            currentPath,
            childRoute.path,
            "main",
          );
          const childRouteObject = { id: childRouteId, path: childRoute.path };
          routeObjectChildren.push(childRouteObject);

          parentPathStack.push(childRouteId);
          routeStack.push(childRoute);
          routeObjectStack.push(childRouteObject);
        }
      }

      if (route.catchall) {
        const catchallRouteId = generateRouteId(currentPath, "", "catchall");
        const catchallRouteObject = {
          id: catchallRouteId,
          path: "*",
          lazy: createLazyRoute<Context>(
            route.catchall,
            route.serverCatchall,
            catchallRouteId,
          ),
        };
        routeObjectChildren.push(catchallRouteObject);

        this.routeFileMap.set(catchallRouteId, route.catchall);
        this.routeObjectMap.set(catchallRouteId, catchallRouteObject);
      }

      if (routeObjectChildren.length > 0) {
        routeObject.children = routeObjectChildren;
      }

      if (route.main) {
        this.routeFileMap.set(routeId, route.main);
      }
      this.routeObjectMap.set(routeId, routeObject);
    }
  }

  /**
   * Gets the hydration data for the application.
   *
   * @returns The hydration data for the application.
   */
  getHydrationData(): HydrationData {
    const serializedHydrationData: SerializedHydrationData =
      env.getHydrationData() ?? { json: {} };
    const rootMainModule = typeof this.rootRoute.main === "function"
      ? undefined
      : this.rootRoute.main;
    const deserializeError = rootMainModule?.deserializeError;

    return deserializeHydrationData(serializedHydrationData, {
      deserializeError,
    });
  }

  /**
   * Awaits lazy-loaded routes for the current matches to ensure they are fully loaded
   * before hydrating the application. This prevents loaders and actions from needing to be called
   * again on the client when initially rendering.
   *
   * @param matches - The matches to load.
   * @returns A promise that resolves when the lazy matches are loaded.
   */
  async loadLazyMatches(matches: { id: string }[]): Promise<void> {
    for (const match of matches) {
      const route = this.routeObjectMap.get(match.id);
      if (route?.lazy) {
        const {
          Component,
          ErrorBoundary,
          HydrateFallback,
          loader,
          action,
        } = await (route.lazy as LazyRoute<Context>)();
        if (Component) route.Component = Component;
        if (ErrorBoundary) route.ErrorBoundary = ErrorBoundary;
        if (HydrateFallback) route.HydrateFallback = HydrateFallback;
        if (loader) route.loader = loader;
        if (action) route.action = action;
        delete route.lazy;
      }
    }
  }

  /**
   * Hydrates the application.
   * This function sets up the browser router and renders the application.
   */
  async hydrate() {
    const { matches, ...hydrationData } = this.getHydrationData();

    await this.loadLazyMatches(matches);

    const router = createBrowserRouter(this.routeObjects, { hydrationData });

    function hydrate() {
      startTransition(() => {
        hydrateRoot(
          document,
          <StrictMode>
            <App>
              <RouterProvider router={router} />
            </App>
          </StrictMode>,
          {
            onUncaughtError: (error: unknown) => {
              console.error("hydrate onUncaughtError", error);
            },
            onCaughtError: (error: unknown) => {
              console.error("hydrate onCaughtError", error);
            },
          },
        );
      });
    }

    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(hydrate);
    } else {
      // Safari doesn't support requestIdleCallback
      setTimeout(hydrate, 1);
    }
  }
}
