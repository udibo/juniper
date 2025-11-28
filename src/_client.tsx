import { HttpError } from "@udibo/http-error";
import {
  type ActionFunctionArgs,
  type HydrationState,
  type LoaderFunctionArgs,
  type RouterContextProvider,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
  useRouteError,
} from "react-router";
import SuperJSON from "superjson";
import type { SuperJSONResult } from "superjson";
import React from "react";
import type { ComponentType } from "react";

import type {
  AnyParams,
  ErrorBoundaryProps,
  RouteModule,
  RouteProps,
} from "@udibo/juniper";

/** A serialized error. */
export type SerializedError = {
  __type: "Error";
  __subType?: string;
  message?: string;
  stack?: string;
};

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

/**
 * Tracks which data keys were successfully resolved or rejected during promise resolution.
 * Used to reconstruct the original Promise state during deserialization.
 */
export interface SerializedHydrationDataPromises {
  /** Keys of loader data that were resolved successfully */
  loaderData?: {
    [key: string]: string[];
  };
  /** Keys of action data that were resolved successfully */
  actionData?: {
    [key: string]: string[];
  };
}

/**
 * Extended SuperJSON result that includes metadata about resolved and rejected promises
 * to enable proper reconstruction of Promise states during deserialization.
 */
export interface SerializedHydrationData extends SuperJSONResult {
  /** Public environment variables shared with the client */
  publicEnv?: Record<string, string>;
  /** Keys that were successfully resolved during serialization */
  resolved?: SerializedHydrationDataPromises;
  /** Keys that were rejected during serialization */
  rejected?: SerializedHydrationDataPromises;
}

/**
 * Reconstructs Promise states for a specific data type (loader or action data)
 * based on the resolved and rejected keys metadata.
 * Uses custom deserializeError function if provided, otherwise falls back to default.
 */
function reconstructPromiseStates(
  data: Record<string, Record<string, unknown>>,
  resolvedKeys: Record<string, string[]> | undefined,
  rejectedKeys: Record<string, string[]> | undefined,
  deserializeError?: (serializedError: unknown) => unknown,
): void {
  // Reconstruct resolved promises
  if (resolvedKeys) {
    for (const [routeId, keys] of Object.entries(resolvedKeys)) {
      for (const key of keys) {
        const value = data[routeId][key];
        data[routeId][key] = Promise.resolve(value);
      }
    }
  }

  // Reconstruct rejected promises
  if (rejectedKeys) {
    for (const [routeId, keys] of Object.entries(rejectedKeys)) {
      for (const key of keys) {
        const serializedError = data[routeId][key];
        data[routeId][key] = Promise.reject(
          deserializeError?.(serializedError) ??
            deserializeErrorDefault(serializedError),
        );
      }
    }
  }
}

/**
 * Represents the complete hydration state data structure containing route matches,
 * errors, loader data, and action data that needs to be serialized for client-side hydration.
 */
export interface HydrationData {
  /** Public environment variables shared with the client */
  publicEnv?: Record<string, string>;
  /** Array of route matches with their IDs */
  matches: {
    id: string;
  }[];
  /** Route-level errors keyed by route ID */
  errors?: HydrationState["errors"];
  /** Loader data for each route, may contain Promises that need resolution */
  loaderData?: HydrationState["loaderData"];
  /** Action data for each route, may contain Promises that need resolution */
  actionData?: HydrationState["actionData"];
}

/**
 * Deserializes hydration data and reconstructs the original Promise states
 * using the resolved/rejected metadata from serialization.
 * Uses custom deserializeError function if provided, otherwise falls back to default.
 */
export function deserializeHydrationData(
  serializedHydrationData: SerializedHydrationData,
  options: {
    deserializeError?: (serializedError: unknown) => unknown;
  } = {},
): HydrationData {
  const { deserializeError } = options;
  const { json, meta, resolved, rejected } = serializedHydrationData;
  const result = SuperJSON.deserialize<HydrationData>({ json, meta });

  // Deserialize errors
  if (result.errors) {
    for (const [key, serializedError] of Object.entries(result.errors)) {
      result.errors[key] = deserializeError?.(serializedError) ??
        deserializeErrorDefault(serializedError);
    }
  }

  // Reconstruct loader data promises
  if (result.loaderData) {
    reconstructPromiseStates(
      result.loaderData,
      resolved?.loaderData,
      rejected?.loaderData,
      deserializeError,
    );
  }

  // Reconstruct action data promises
  if (result.actionData) {
    reconstructPromiseStates(
      result.actionData,
      resolved?.actionData,
      rejected?.actionData,
      deserializeError,
    );
  }

  return result;
}

/** The globals available in the browser for the application. */
export type ClientGlobals = {
  /** The Juniper application's hydration data. */
  __juniperHydrationData?: SerializedHydrationData;
};

export function App({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

export type Route<
  Context extends RouterContextProvider = RouterContextProvider,
> = {
  Component?: ComponentType;
  ErrorBoundary?: ComponentType;
  HydrateFallback?: ComponentType;
  loader?: (
    args: LoaderFunctionArgs<Context>,
  ) => unknown | Promise<unknown>;
  action?: (
    args: ActionFunctionArgs<Context>,
  ) => unknown | Promise<unknown>;
};

/**
 * Converts a route module into a renderable route object.
 *
 * @template Context - The router context type.
 * @returns A promise that resolves to the route object.
 */
export type LazyRoute<
  Context extends RouterContextProvider = RouterContextProvider,
> = () => Promise<Route<Context>>;

/**
 * Converts a `RouteModule` into the internal `Route` shape used by the client runtime.
 *
 * @template Context - The router context type.
 * @param routeFile - The module exports for the route.
 * @returns A concrete `Route` instance.
 */
export function createRoute<
  Context extends RouterContextProvider = RouterContextProvider,
>(
  routeFile: RouteModule<AnyParams, unknown, unknown, Context>,
): Route<Context> {
  const {
    ErrorBoundary: _ErrorBoundary,
    default: _Component,
    HydrateFallback: _HydrateFallback,
  } = routeFile;

  let Component: ComponentType | undefined;
  if (_Component) {
    Component = function Component() {
      const params = useParams();
      const loaderData = useLoaderData();
      const actionData = useActionData();

      return React.createElement(
        _Component as ComponentType<RouteProps>,
        {
          params,
          loaderData,
          actionData,
        },
      );
    };
  }

  let ErrorBoundary: ComponentType | undefined;
  if (_ErrorBoundary) {
    ErrorBoundary = function ErrorBoundary() {
      const params = useParams();
      const loaderData = useLoaderData();
      const actionData = useActionData();
      const error = useRouteError();
      const navigate = useNavigate();
      const location = useLocation();

      function resetErrorBoundary() {
        navigate(location.pathname, { replace: true });
      }

      return React.createElement(
        _ErrorBoundary as ComponentType<ErrorBoundaryProps>,
        {
          error,
          resetErrorBoundary,
          params,
          loaderData,
          actionData,
        },
      );
    };
  }

  let HydrateFallback: ComponentType | undefined;
  if (_HydrateFallback) {
    HydrateFallback = function HydrateFallback() {
      const params = useParams();
      const loaderData = useLoaderData();
      const actionData = useActionData();

      return React.createElement(
        _HydrateFallback as ComponentType<RouteProps>,
        {
          params,
          loaderData,
          actionData,
        },
      );
    };
  }

  return {
    Component: Component,
    ErrorBoundary: ErrorBoundary,
    HydrateFallback: HydrateFallback,
    loader: routeFile.loader,
    action: routeFile.action,
  };
}

/**
 * Creates a lazy route object that loads a `RouteModule` and converts it to a route object.
 *
 * @template Context - The router context type.
 * @param lazyRouteFile - The lazy route file to create a lazy route object from.
 * @returns A lazy route object.
 */
export function createLazyRoute<
  Context extends RouterContextProvider = RouterContextProvider,
>(
  lazyRouteFile: () => Promise<
    RouteModule<AnyParams, unknown, unknown, Context>
  >,
): LazyRoute<Context> {
  return async (): Promise<Route<Context>> => {
    const routeFile = await lazyRouteFile();
    return createRoute(routeFile);
  };
}

/** The default router context provider. */
export type DefaultContext = RouterContextProvider;
