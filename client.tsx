/**
 * The client module for the Juniper framework. This module is meant to be used exclusively by the generated `main.tsx` file.
 *
 * @module
 */
import type { ComponentType } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import type {
  ActionFunctionArgs,
  HydrationState,
  LoaderFunctionArgs,
  RouteObject,
  unstable_RouterContextProvider,
} from "react-router";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HttpError } from "@udibo/http-error";

/** The default router context type. */
export type DefaultContext = unstable_RouterContextProvider;

/** A client route file. */
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

/** A root client route file. This is the top level main.tsx file in the routes directory. */
export interface RootClientRouteFile<Context = DefaultContext>
  extends ClientRouteFile<Context> {
  /**
   * This function is used to extend the default error deserialization.
   * It converts errors serialized by the server into errors in the client.
   * If it doesn't exist or returns undefined, the default error deserialization will be used.
   */
  deserializeError?: (serializedError: unknown) => unknown;
}

/** A client route. */
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

/** The root client route. */
export interface RootClientRoute<Context = DefaultContext>
  extends ClientRoute<Context> {
  main?: RootClientRouteFile<Context>;
}

/** A route object that is lazy loaded. */
export type LazyRouteObject = () => Promise<{
  Component?: ComponentType;
  ErrorBoundary?: ComponentType;
  loader?: (args: LoaderFunctionArgs) => Promise<unknown>;
  action?: (args: ActionFunctionArgs) => Promise<unknown>;
}>;

/**
 * Creates a lazy route object that loads the route file and converts it to a route object.
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

/** A serialized error. */
export type SerializedError = {
  __type: "Error";
  __subType?: string;
  message?: string;
  stack?: string;
};

/**
 * Checks if a value is a serialized error.
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
 * Deserializes a serialized error to an error.
 * The default deserialize error function supports HttpError, Error, and Error subclasses like TypeError.
 */
export function deserializeErrorDefault(
  serializedError: SerializedError | unknown,
): Error | unknown | undefined {
  let error: Error | unknown = serializedError;
  const { __type, __subType, stack, ...rest } =
    (typeof error === "object" ? error : {}) as SerializedError;
  if (__type === "Error") {
    if (__subType === "HttpError") {
      error = HttpError.from(rest);
    } else {
      const message = rest.message;
      const ErrorConstructor = __subType
        ? (globalThis as Record<string, unknown>)[__subType] as ErrorConstructor
        : Error;
      error = typeof ErrorConstructor === "function"
        ? new ErrorConstructor(message)
        : new Error(message);
    }

    if (stack) {
      (error as Error).stack = stack;
    }
  }
  return error;
}

export type SerializedField = {
  __type?: "Promise";
  value?: unknown;
  error?: unknown;
};

export type SerializedFieldMap = Record<string, SerializedField>;

export type SerializedRouteData = {
  __type?: "Promise";
  value?: SerializedFieldMap;
  error?: unknown;
};

export type SerializedRouteDataMap = Record<string, SerializedRouteData>;

/** The hydration data for the application. */
export type HydrationData = {
  /** The matches for server rendered routes. */
  matches?: {
    id: string;
  }[];
  /** The errors for the application. */
  errors?: Record<string, SerializedError | unknown> | null;
  /** The loader data for the application. */
  loaderData?: SerializedRouteDataMap;
  /** The action data for the application. */
  actionData?: SerializedRouteDataMap | null;
};

/** The globals available in the browser for the application. */
export type ClientGlobals = {
  /** The Juniper application's hydration data. */
  __juniperHydrationData?: HydrationData;
  // Delete this later, going to remove it completely at some point.
  __staticRouterHydrationData?: HydrationState;
};

/**
 * Deserializes serialized route data (loaderData or actionData) to its client-side format.
 */
export function deserializeRouteData(
  serializedRouteData: SerializedRouteDataMap,
  deserializeError: (error: unknown) => unknown,
): HydrationState["loaderData"] {
  const deserializedData: HydrationState["loaderData"] = {};
  for (
    const [id, serializedRouteDataEntry] of Object.entries(serializedRouteData)
  ) {
    const deserializedRouteDataEntry: Record<
      string,
      Promise<unknown> | unknown
    > = {};
    const { __type, value: fieldMap, error } = serializedRouteDataEntry;
    if (fieldMap) {
      for (const [key, serializedField] of Object.entries(fieldMap)) {
        const { __type, value, error } = serializedField;
        if (__type === "Promise") {
          if (error) {
            deserializedRouteDataEntry[key] = Promise.reject(
              deserializeError(error) ?? deserializeErrorDefault(error),
            );
          } else {
            deserializedRouteDataEntry[key] = Promise.resolve(value);
          }
        } else {
          deserializedRouteDataEntry[key] = value;
        }
      }
    }

    if (__type === "Promise") {
      if (error) {
        deserializedData[id] = Promise.reject(
          deserializeError(error) ?? deserializeErrorDefault(error),
        );
      } else {
        deserializedData[id] = Promise.resolve(deserializedRouteDataEntry);
      }
    } else {
      deserializedData[id] = deserializedRouteDataEntry;
    }
  }
  return deserializedData;
}

/** The client for a Juniper application. */
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
   * Gets the react router hydration data for the application.
   */
  getHydrationData(): HydrationState {
    const hydrationData: HydrationData =
      (globalThis as ClientGlobals).__juniperHydrationData ?? {};

    // move this to it's own function
    let errors: HydrationState["errors"] = null;
    const serializedErrors = hydrationData.errors ?? {};
    const deserializeError = this.rootRoute.main?.deserializeError ??
      (() => {});
    for (const [key, serializedError] of Object.entries(serializedErrors)) {
      if (!errors) errors = {};
      errors[key] = deserializeError?.(serializedError) ??
        deserializeErrorDefault(serializedError);
    }

    const deserializedLoaderData = hydrationData.loaderData &&
      deserializeRouteData(hydrationData.loaderData, deserializeError);
    const deserializedActionData = hydrationData.actionData &&
      deserializeRouteData(hydrationData.actionData, deserializeError);

    return {
      errors,
      loaderData: deserializedLoaderData,
      actionData: deserializedActionData,
    };
  }

  /**
   * Awaits lazy-loaded routes for the current matches to ensure they are fully loaded
   * before hydrating the application. This prevents loaders and actions from needing to be called
   * again on the client when initially rendering.
   */
  async loadLazyMatches(): Promise<void> {
    const hydrationData: HydrationData =
      (globalThis as ClientGlobals).__juniperHydrationData ?? {};
    for (const match of hydrationData.matches ?? []) {
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
    await this.loadLazyMatches();

    const router = createBrowserRouter(this.routeObjects, {
      hydrationData: this.getHydrationData(),
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

    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(hydrate);
    } else {
      // Safari doesn't support requestIdleCallback
      setTimeout(hydrate, 1);
    }
  }
}
