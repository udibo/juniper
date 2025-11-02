/**
 * The client module for the Juniper framework. This module is meant to be used exclusively by the generated `main.tsx` file.
 *
 * @module
 */
import { startTransition, StrictMode } from "react";
import type { ComponentType } from "react";
import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  RouteObject,
  RouterContextProvider,
} from "react-router";

import { App, deserializeHydrationData } from "./_client.tsx";
import type {
  ClientGlobals,
  HydrationData,
  SerializedError,
  SerializedHydrationData,
} from "./_client.tsx";

export type { HydrationData, SerializedError };

/** The default router context provider. */
export type DefaultContext = RouterContextProvider;

/**
 * A client route file.
 *
 * @template Context - The router context type.
 */
export interface ClientRouteFile<Context = DefaultContext> {
  /** The route's component. */
  default?: ComponentType;
  /** The route's error boundary component. */
  ErrorBoundary?: ComponentType;
  /** The loader function. */
  loader?: (args: LoaderFunctionArgs<Context>) => Promise<unknown>;
  /** The action function. */
  action?: (args: ActionFunctionArgs<Context>) => Promise<unknown>;
}

/**
 * A root client route file. This is the top level main.tsx file in the routes directory.
 *
 * @template Context - The router context type.
 */
export interface RootClientRouteFile<Context = DefaultContext>
  extends ClientRouteFile<Context> {
  /**
   * This function is used to extend the default error deserialization.
   * It converts errors serialized by the server into errors in the client.
   * If it doesn't exist or returns undefined, the default error deserialization will be used.
   */
  deserializeError?: (serializedError: unknown) => unknown;
}

/**
 * A client route.
 *
 * @template Context - The router context type.
 */
export interface ClientRoute<Context = DefaultContext> {
  path: string;
  /** The route's main file. */
  main?: ClientRouteFile<Context> | (() => Promise<ClientRouteFile<Context>>);
  /** The route's index file. */
  index?: () => Promise<ClientRouteFile<Context>>;
  /** The route's catchall file. */
  catchall?: () => Promise<ClientRouteFile<Context>>;
  /** The route's children. */
  children?: ClientRoute<Context>[];
}

/**
 * The root client route.
 *
 * @template Context - The router context type.
 */
export interface RootClientRoute<Context = DefaultContext>
  extends ClientRoute<Context> {
  /** The root route's main file. */
  main?: RootClientRouteFile<Context>;
}

/**
 * A function that lazy loads a route file and returns a route object.
 *
 * @returns A promise that resolves to the route object.
 */
export type LazyRouteObject = () => Promise<{
  Component?: ComponentType;
  ErrorBoundary?: ComponentType;
  loader?: (args: LoaderFunctionArgs) => Promise<unknown>;
  action?: (args: ActionFunctionArgs) => Promise<unknown>;
}>;

/**
 * Creates a lazy route object that loads the route file and converts it to a route object.
 *
 * @param lazyRouteFile - The lazy route file to create a lazy route object from.
 * @returns A lazy route object.
 */
export function createLazyRouteObject(
  lazyRouteFile: () => Promise<ClientRouteFile>,
): LazyRouteObject {
  return async () => {
    const routeFile = await lazyRouteFile();
    return {
      Component: routeFile.default,
      ErrorBoundary: routeFile.ErrorBoundary,
      loader: routeFile.loader,
      action: routeFile.action,
    };
  };
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
 * @param rootRoute - The root client route.
 * @returns A new client instance.
 */
export class Client {
  /** The root client route. */
  rootRoute: RootClientRoute;
  /** A map of route ids to client routes. */
  routeFileMap: Map<
    string,
    ClientRouteFile | (() => Promise<ClientRouteFile>)
  >;
  /** The route objects used by React Router. */
  routeObjects: RouteObject[];
  /** A map of route object ids to route objects used by React Router. */
  routeObjectMap: Map<string, RouteObject>;

  constructor(rootRoute: RootClientRoute) {
    this.rootRoute = rootRoute;
    this.routeFileMap = new Map();
    this.routeObjects = [{ path: rootRoute.path }];
    this.routeObjectMap = new Map();

    const routeIdStack: string[] = ["0"];
    const routeStack: ClientRoute[] = [rootRoute];
    const routeObjectStack: RouteObject[] = [...this.routeObjects];
    while (routeIdStack.length > 0) {
      const routeId = routeIdStack.pop()!;
      const route = routeStack.pop()!;
      const routeObject = routeObjectStack.pop()!;

      if (typeof route.main === "function") {
        routeObject.lazy = createLazyRouteObject(route.main);
      } else if (route.main) {
        routeObject.Component = route.main.default;
        routeObject.ErrorBoundary = route.main.ErrorBoundary;
        routeObject.loader = route.main.loader;
      }

      const routeObjectChildren: RouteObject[] = [];

      if (route.index) {
        const indexRouteObject = {
          index: true,
          lazy: createLazyRouteObject(route.index),
        };
        routeObjectChildren.push(indexRouteObject);

        const indexRouteId = `${routeId}-0`;
        this.routeFileMap.set(indexRouteId, route.index);
        this.routeObjectMap.set(indexRouteId, indexRouteObject);
      }

      if (route.children) {
        const offset = route.index ? 1 : 0;
        for (const [childIndex, childRoute] of route.children.entries()) {
          const childRouteId = `${routeId}-${childIndex + offset}`;
          const childRouteObject = { path: childRoute.path };
          routeObjectChildren.push(childRouteObject);

          routeIdStack.push(childRouteId);
          routeStack.push(childRoute);
          routeObjectStack.push(childRouteObject);
        }
      }

      if (route.catchall) {
        const catchallRouteObject = {
          path: "*",
          lazy: createLazyRouteObject(route.catchall),
        };
        routeObjectChildren.push(catchallRouteObject);

        const catchallRouteId = `${routeId}-${routeObjectChildren.length - 1}`;
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
      (globalThis as ClientGlobals).__juniperHydrationData ?? { json: {} };
    const deserializeError = this.rootRoute.main?.deserializeError;

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
        const { Component, ErrorBoundary, loader, action } =
          await (route.lazy as LazyRouteObject)();
        if (Component) route.Component = Component;
        if (ErrorBoundary) route.ErrorBoundary = ErrorBoundary;
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
