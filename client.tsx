import type { ComponentType } from "react";
import type { RouteObject } from "react-router";

export interface RouteFile {
  default?: ComponentType;
  ErrorBoundary?: ComponentType;
}

export interface Routes {
  path: string;
  main?: RouteFile | (() => Promise<RouteFile>);
  index?: () => Promise<RouteFile>;
  catchall?: () => Promise<RouteFile>;
  children?: Routes[];
}

/**
 * Client object that will be used in the generated `main.tsx` file.
 * It will be used to hydrate the client and server.
 */
export interface Client {
  /** Application routes */
  appRoutes: Routes;
  /** React router routes */
  routes: RouteObject[];
}

// This will be used in the generated `main.tsx` file.
// It will convert routes to react router routes.
// The server and client hydration will use the reactRoutes.
export function createClient(routes: Routes): Client {
  // Hardcoded the routes for now.
  const main = routes.main as RouteFile;
  const Component = main.default;
  const ErrorBoundary = main.ErrorBoundary;
  return {
    appRoutes: routes,
    routes: [{
      path: "/",
      Component,
      ErrorBoundary,
      children: [
        {
          index: true,
          lazy: async () => {
            const Component = (await routes.index!()).default;
            const ErrorBoundary = (await routes.index!()).ErrorBoundary;
            return {
              Component,
              ErrorBoundary,
            };
          },
        },
        {
          path: "/about",
          lazy: async () => {
            const Component =
              (await (routes.children![0]!.main as () => Promise<
                RouteFile
              >)!()).default;
            const ErrorBoundary =
              (await (routes.children![0]!.main as () => Promise<
                RouteFile
              >)!()).ErrorBoundary;
            return {
              Component,
              ErrorBoundary,
            };
          },
        },
      ],
    }],
  };
}

export function hydrate(client: Client) {
  client;
  return null;
}
