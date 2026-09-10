/**
 * The client module for the Juniper framework. This module is meant to be used exclusively by the generated `main.tsx` file.
 *
 * @module
 */
import { startTransition, StrictMode, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterContextProvider,
  RouterProvider,
} from "react-router";
import type { RouteObject } from "react-router";
import { HttpError } from "@udibo/http-error";
import type { HtmlProps, RootRouteModule, RouteModule } from "./mod.ts";

import {
  App,
  createLazyRoute,
  createRoute,
  deserializeHydrationData,
  generateRouteId,
  JuniperContextProvider,
  registerRouter,
  setClientBuildId,
} from "./_client.tsx";
import type { HydrationData, LazyRoute, ServerFlags } from "./_client.tsx";
import { deserializeAllContext } from "./_serialization.ts";
import { env } from "./utils/_env.ts";

export type { HydrationData, ServerFlags };

/** Loads a non-root route module on demand. */
export type RouteModuleLoader = () => Promise<RouteModule>;

/** Loads the root route module on demand. */
export type RootRouteModuleLoader = () => Promise<RootRouteModule>;

/** A client route definition used by the generated `main.tsx`. */
export interface ClientRoute {
  /** The route's URL path segment. */
  path: string;
  /**
   * The route's module.
   * Provide a `RouteModule` directly or a lazy loader that resolves to one.
   */
  main?: RouteModule | RouteModuleLoader;
  /**
   * The route's index module.
   * Must resolve to a `RouteModule`.
   */
  index?: RouteModuleLoader;
  /**
   * The route's catchall module.
   * Must resolve to a `RouteModule`.
   */
  catchall?: RouteModuleLoader;
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
  children?: ClientRoute[];
}

/** The root client route. */
export interface RootClientRoute extends ClientRoute {
  /**
   * The root route's module.
   * Provide a `RootRouteModule` or lazy loader.
   */
  main?: RootRouteModule | RootRouteModuleLoader;
}

/**
 * Client route registry and browser hydration entrypoint.
 *
 * The build generates its configuration in `main.tsx`; application routes usually
 * never construct this class. Importing it during SSR creates route definitions
 * without touching the DOM. Only call `hydrate` in a browser with matching SSR data.
 *
 * @example
 * ```tsx
 * import { Client } from "@udibo/juniper/client";
 * export const client = new Client({
 *   path: "/",
 *   main: { default: () => <h1>Hello</h1> },
 * });
 * ```
 */
export class Client {
  /** The root client route. */
  rootRoute: RootClientRoute;
  /** A map of route ids to client routes. */
  routeFileMap: Map<string, RouteModule | RouteModuleLoader>;
  /** The route objects used by React Router. */
  routeObjects: RouteObject[];
  /** A map of route object ids to route objects used by React Router. */
  routeObjectMap: Map<string, RouteObject>;
  /** Props to apply to the `<html>` element, from root route's htmlProps export. */
  htmlProps?: HtmlProps;

  #rootModule?: RootRouteModule;

  /**
   * Builds the client route tree from a root route, ready to
   * {@linkcode Client.hydrate}.
   *
   * @param rootRoute - The root client route, typically the generated `main.tsx`.
   */
  constructor(rootRoute: RootClientRoute) {
    this.rootRoute = rootRoute;
    this.routeFileMap = new Map();
    const rootRouteId = "/";
    this.routeObjects = [{ id: rootRouteId, path: rootRoute.path }];
    this.routeObjectMap = new Map();

    if (rootRoute.main && typeof rootRoute.main !== "function") {
      this.#rootModule = rootRoute.main;
      this.htmlProps = rootRoute.main.htmlProps;
    }

    const parentPathStack: string[] = ["/"];
    const routeStack: ClientRoute[] = [rootRoute];
    const routeObjectStack: RouteObject[] = [...this.routeObjects];
    while (parentPathStack.length > 0) {
      const currentPath = parentPathStack.pop()!;
      const route = routeStack.pop()!;
      const routeObject = routeObjectStack.pop()!;
      const routeId = routeObject.id!;

      if (typeof route.main === "function") {
        const loadModule = route.main;
        routeObject.lazy = createLazyRoute(
          route === rootRoute
            ? async () => {
              const module = await (loadModule as RootRouteModuleLoader)();
              this.#rootModule = module;
              return module;
            }
            : loadModule,
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
          middleware,
        } = createRoute(route.main, route.server, routeId);
        routeObject.Component = Component;
        routeObject.ErrorBoundary = ErrorBoundary;
        routeObject.HydrateFallback = HydrateFallback;
        routeObject.loader = loader;
        routeObject.action = action;
        if (middleware) {
          (routeObject as { middleware: unknown }).middleware = middleware;
        }
      }

      const routeObjectChildren: RouteObject[] = [];

      if (route.index) {
        const indexRouteId = generateRouteId(currentPath, "", "index");
        const indexRouteObject: RouteObject = {
          id: indexRouteId,
          index: true,
          lazy: createLazyRoute(
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
        const catchallRouteObject: RouteObject = {
          id: catchallRouteId,
          path: "*",
          lazy: createLazyRoute(
            route.catchall,
            route.serverCatchall,
            catchallRouteId,
          ),
        };
        routeObjectChildren.push(catchallRouteObject);

        this.routeFileMap.set(catchallRouteId, route.catchall);
        this.routeObjectMap.set(catchallRouteId, catchallRouteObject);
      } else {
        // Default catchall throws 404 so errors bubble to the nearest ErrorBoundary.
        const catchallRouteId = generateRouteId(currentPath, "", "catchall");
        const catchallRouteObject: RouteObject = {
          id: catchallRouteId,
          path: "*",
          loader: () => {
            throw new HttpError(404, "Not found");
          },
          Component: () => <div />,
        };
        routeObjectChildren.push(catchallRouteObject);
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
   * Reads the hydration data the server embedded in the document.
   *
   * @throws Error if the document was not server-rendered by Juniper.
   */
  getHydrationData(): HydrationData {
    const serializedHydrationData = env.getHydrationData();
    if (!serializedHydrationData) {
      throw new Error("No hydration data available");
    }
    return deserializeHydrationData(serializedHydrationData);
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
        } = await (route.lazy as LazyRoute)();
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
   * Starts browser hydration using the data embedded in the SSR document.
   *
   * Load matched modules, restore registered context, then schedule React
   * hydration for an idle callback. Resolving this promise means hydration was
   * scheduled, not that React has committed or the page is interactive.
   *
   * Missing modules can initiate a guarded document navigation. That recovery
   * stays pending to preserve SSR markup. Once the retry budget is exhausted,
   * failures are logged and handed to the router's error boundary. Call once
   * per document; generated entrypoints already do so.
   *
   * @returns A promise for scheduling hydration; it stays pending during recovery.
   * @throws {Error} If the document has no Juniper hydration data.
   */
  async hydrate(): Promise<void> {
    const { matches, serializedContext, buildId, ...hydrationData } = this
      .getHydrationData();
    setClientBuildId(buildId);

    try {
      await this.loadLazyMatches(matches);
    } catch (error) {
      console.error("Failed to load a route module during hydration:", error);
    }

    const context = new RouterContextProvider();
    deserializeAllContext(
      serializedContext as Record<string, unknown> | undefined,
      context,
    );

    const router = createBrowserRouter(this.routeObjects, {
      hydrationData,
      getContext: () => context,
    });
    registerRouter(router);

    const htmlProps = this.htmlProps;
    const beforeHydrate = this.#rootModule?.beforeHydrate;
    function HydratedApp() {
      const [routerContext] = useState(() => context);
      return (
        <StrictMode>
          <App htmlProps={htmlProps}>
            <JuniperContextProvider context={routerContext}>
              <RouterProvider router={router} />
            </JuniperContextProvider>
          </App>
        </StrictMode>
      );
    }

    function hydrate() {
      let dispose = beforeHydrate?.(document);
      function release(): void {
        document.defaultView?.removeEventListener("pagehide", onPageHide);
        const cleanup = dispose;
        dispose = undefined;
        cleanup?.();
      }
      function onPageHide(event: PageTransitionEvent): void {
        if (!event.persisted) release();
      }
      if (dispose) {
        document.defaultView?.addEventListener("pagehide", onPageHide);
      }
      startTransition(() => {
        try {
          hydrateRoot(
            document,
            <HydratedApp />,
            {
              onUncaughtError: (error: unknown) => {
                release();
                console.error("hydrate onUncaughtError", error);
              },
              onCaughtError: (error: unknown) => {
                console.error("hydrate onCaughtError", error);
              },
            },
          );
        } catch (error) {
          release();
          throw error;
        }
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
