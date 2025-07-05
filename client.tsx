import type { ComponentType } from "react";
import {
  createBrowserRouter,
  type HydrationState,
  type LoaderFunctionArgs,
  type RouteObject,
  RouterProvider,
  unstable_createContext,
  type unstable_RouterContextProvider,
} from "react-router";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

export type DefaultContext = unstable_RouterContextProvider;
export interface RouteFile<Context = DefaultContext> {
  default?: ComponentType;
  ErrorBoundary?: ComponentType;
  loader?: (args: LoaderFunctionArgs<Context>) => Promise<unknown>;
}

export interface Routes<Context = DefaultContext> {
  path: string;
  main?: RouteFile<Context> | (() => Promise<RouteFile<Context>>);
  index?: () => Promise<RouteFile<Context>>;
  catchall?: () => Promise<RouteFile<Context>>;
  children?: Routes<Context>[];
}

/**
 * Client object that will be used in the generated `main.tsx` file.
 * It will be used to hydrate the client and server.
 */
export interface Client<Context = DefaultContext> {
  /** Application routes */
  appRoutes: Routes<Context>;
  /** React router routes */
  routes: RouteObject[];
}

export function createAppContext<T>() {
  return unstable_createContext<T>();
}

/**
 * Converts a route path from file-system based pattern to React Router pattern.
 * Examples:
 * - /blog/[id] -> /blog/:id
 * - /api/[...rest] -> /api/*
 * - [id] -> :id (for nested routes)
 */
function convertRoutePatternToReactRouter(
  path: string,
  isNested = false,
): string {
  let convertedPath = path
    .replace(/\[([^\]]+)\]/g, (_match, param) => {
      if (param.startsWith("...")) {
        return "*";
      }
      return `:${param}`;
    });

  if (isNested && convertedPath.startsWith("/")) {
    convertedPath = convertedPath.slice(1);
  }

  return convertedPath;
}

/**
 * Creates a lazy route handler that loads the route file and extracts components/loaders.
 */
function createLazyRouteHandler(
  routeLoader: () => Promise<RouteFile>,
): () => Promise<
  {
    Component?: ComponentType;
    ErrorBoundary?: ComponentType;
    loader?: (args: LoaderFunctionArgs) => Promise<unknown>;
  }
> {
  return async () => {
    const routeFile = await routeLoader();
    return {
      Component: routeFile.default,
      ErrorBoundary: routeFile.ErrorBoundary,
      loader: routeFile.loader,
    };
  };
}

/**
 * Recursively converts Routes structure to React Router RouteObject[].
 */
function convertRoutesToRouteObjects(
  routes: Routes,
  isNested = false,
): RouteObject[] {
  const result: RouteObject[] = [];

  const routePath = convertRoutePatternToReactRouter(routes.path, isNested);
  const routeObject: RouteObject = {
    path: routePath === "/" ? "/" : routePath,
  };

  if (typeof routes.main === "function") {
    routeObject.lazy = createLazyRouteHandler(routes.main);
  } else if (routes.main) {
    routeObject.Component = routes.main.default;
    routeObject.ErrorBoundary = routes.main.ErrorBoundary;
    routeObject.loader = routes.main.loader;
  }

  const childRoutes: RouteObject[] = [];

  if (routes.index) {
    childRoutes.push({
      index: true,
      lazy: createLazyRouteHandler(routes.index),
    });
  }

  if (routes.children) {
    for (const child of routes.children) {
      const childRouteObjects = convertRoutesToRouteObjects(child, true);
      childRoutes.push(...childRouteObjects);
    }
  }

  if (routes.catchall) {
    childRoutes.push({
      path: "*",
      lazy: createLazyRouteHandler(routes.catchall),
    });
  }

  if (childRoutes.length > 0) {
    routeObject.children = childRoutes;
  }

  result.push(routeObject);

  return result;
}

/**
 * Creates a client object that will be used in the generated `main.tsx` file.
 * It will be used to hydrate the client and generate the server routes.
 */
export function createClient(routes: Routes): Client {
  const reactRoutes = convertRoutesToRouteObjects(routes);

  return {
    appRoutes: routes,
    routes: reactRoutes,
  };
}

type AppGlobals = {
  __staticRouterHydrationData?: HydrationState;
};

/**
 * Hydrates the client application with the provided client configuration.
 * This function sets up the browser router and renders the application.
 */
export function hydrate(client: Client) {
  const hydrationData = (window as AppGlobals).__staticRouterHydrationData;
  const router = createBrowserRouter(client.routes, {
    hydrationData,
  });

  function hydrate() {
    startTransition(() => {
      hydrateRoot(
        document.getElementById("root"),
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>,
      );
    });
  }

  /*
  // Temporarily disabled until server/client loaders are implemented.
  // The current example loaders only work on the server, not the client.
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(hydrate);
  } else {
    // Safari doesn't support requestIdleCallback
    setTimeout(hydrate, 1);
  }
  */
}
