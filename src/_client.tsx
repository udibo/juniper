import { HttpError } from "@udibo/http-error";
import {
  Await,
  redirect,
  useActionData,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
  useRouteError,
} from "react-router";
import type {
  ActionFunction,
  ActionFunctionArgs,
  HydrationState,
  LoaderFunction,
  LoaderFunctionArgs,
  MiddlewareFunction as ReactRouterMiddlewareFunction,
  RouterContextProvider,
} from "react-router";
import SuperJSON from "superjson";
import type { SuperJSONResult } from "superjson";
import React, { createContext, Suspense, useContext } from "react";
import type { ComponentType } from "react";

import type {
  ErrorBoundaryProps,
  HydrateFallbackProps,
  MiddlewareFunction,
  RouteModule,
  RouteProps,
} from "@udibo/juniper";

const JuniperContext = createContext<RouterContextProvider | undefined>(
  undefined,
);

export function JuniperContextProvider({
  context,
  children,
}: {
  context: RouterContextProvider;
  children: React.ReactNode;
}) {
  return (
    <JuniperContext.Provider value={context}>
      {children}
    </JuniperContext.Provider>
  );
}

export function useJuniperContext(): RouterContextProvider {
  const context = useContext(JuniperContext);
  if (!context) {
    throw new Error(
      "useJuniperContext must be used within a JuniperContextProvider",
    );
  }
  return context;
}

export interface ServerFlags {
  loader?: boolean;
  action?: boolean;
}

function normalizeSegmentForId(segment: string): string {
  return segment.replace(/:(\w+)/g, "[$1]");
}

export function generateRouteId(
  parentPath: string,
  segment: string,
  type: "main" | "index" | "catchall",
): string {
  const normalizedSegment = normalizeSegmentForId(segment);
  let fullPath: string;
  if (parentPath === "/") {
    fullPath = normalizedSegment ? `/${normalizedSegment}` : "/";
  } else {
    fullPath = normalizedSegment
      ? `${parentPath}/${normalizedSegment}`
      : parentPath;
  }

  switch (type) {
    case "index":
      return fullPath === "/" ? "/index" : `${fullPath}/index`;
    case "catchall":
      return fullPath === "/" ? "/[...]" : `${fullPath}/[...]`;
    default:
      return fullPath;
  }
}

const FORM_DATA_CACHE = Symbol("juniperFormDataCache");

type RequestWithFormDataCache = Request & {
  [FORM_DATA_CACHE]?: Promise<FormData>;
};

function getCachedFormData(
  request: RequestWithFormDataCache,
): Promise<FormData> {
  const cached = request[FORM_DATA_CACHE];
  if (cached) return cached;
  const promise = Request.prototype.formData.call(request) as Promise<FormData>;
  request[FORM_DATA_CACHE] = promise;
  return promise;
}

function withCachedRequest(request: Request): RequestWithFormDataCache {
  const requestWithCache = request as RequestWithFormDataCache;
  if (requestWithCache[FORM_DATA_CACHE]) return requestWithCache;

  return new Proxy(requestWithCache, {
    get(target, prop, _receiver) {
      if (prop === "formData") {
        return () => getCachedFormData(target);
      }
      if (prop === FORM_DATA_CACHE) {
        return target[FORM_DATA_CACHE];
      }
      const value = Reflect.get(target, prop, target);
      if (typeof value === "function" && prop !== "constructor") {
        return value.bind(target);
      }
      return value;
    },
  }) as RequestWithFormDataCache;
}

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

async function fetchServerData(
  request: Request,
  method: "GET" | "POST",
  routeId: string,
  deserializeError?: (serializedError: unknown) => unknown,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "X-Juniper-Route-Id": routeId,
  };

  const fetchOptions: RequestInit = { method, headers };
  if (method === "POST") {
    fetchOptions.body = await request.formData();
  }

  const response = await fetch(request.url, fetchOptions);

  const responseType = response.headers.get("X-Juniper");
  if (responseType === "serialized") {
    const serializedData = await response.json();
    const deserialized = SuperJSON.deserialize(serializedData);

    if (!response.ok) {
      throw deserializeError?.(deserialized) ??
        deserializeErrorDefault(deserialized);
    }
    return deserialized;
  } else if (responseType === "redirect") {
    const location = (await response.json()).location;
    return redirect(location);
  }

  if (!response.ok) {
    throw await HttpError.from(response);
  }

  return response;
}

function fetchServerLoader(
  request: Request,
  routeId: string,
  deserializeError?: (serializedError: unknown) => unknown,
): Promise<unknown> {
  return fetchServerData(request, "GET", routeId, deserializeError);
}

function fetchServerAction(
  request: Request,
  routeId: string,
  deserializeError?: (serializedError: unknown) => unknown,
): Promise<unknown> {
  return fetchServerData(request, "POST", routeId, deserializeError);
}

export type Route = {
  Component?: ComponentType;
  ErrorBoundary?: ComponentType;
  HydrateFallback?: ComponentType;
  loader?: (
    args: LoaderFunctionArgs<RouterContextProvider>,
  ) => unknown | Promise<unknown>;
  action?: (
    args: ActionFunctionArgs<RouterContextProvider>,
  ) => unknown | Promise<unknown>;
  middleware?: ReactRouterMiddlewareFunction<RouterContextProvider>[];
};

export type LazyRouteResult = Omit<Route, "middleware">;

/**
 * Converts a route module into a renderable route object.
 *
 * @returns A promise that resolves to the route object.
 */
export type LazyRoute = () => Promise<LazyRouteResult>;

/**
 * Converts a `RouteModule` into the internal `Route` shape used by the client runtime.
 *
 * @param routeFile - The module exports for the route.
 * @param serverFlags - Flags indicating whether the route has server-side loader/action.
 * @param routeId - The route ID used for server data requests.
 * @param deserializeError - Optional custom error deserializer for server errors.
 * @returns A concrete `Route` instance.
 */
export function createRoute(
  routeFile: RouteModule,
  serverFlags?: ServerFlags,
  routeId?: string,
  deserializeError?: (serializedError: unknown) => unknown,
): Route {
  const {
    ErrorBoundary: _ErrorBoundary,
    default: _Component,
    HydrateFallback: _HydrateFallback,
    loader: _loader,
    action: _action,
    middleware: _middleware,
  } = routeFile;

  const hasServerLoader = serverFlags?.loader === true;
  const hasServerAction = serverFlags?.action === true;

  function getServerLoader(request: Request) {
    if (!hasServerLoader) {
      throw new Error("Server loader not available for this route");
    }
    if (!routeId) {
      throw new Error("Route ID is required to fetch server loader data");
    }
    return fetchServerLoader(request, routeId, deserializeError);
  }

  function getServerAction(request: Request) {
    if (!hasServerAction) {
      throw new Error("Server action not available for this route");
    }
    if (!routeId) {
      throw new Error("Route ID is required to fetch server action data");
    }
    return fetchServerAction(request, routeId, deserializeError);
  }

  let HydrateFallback: ComponentType | undefined;
  if (_HydrateFallback) {
    HydrateFallback = function HydrateFallback() {
      const params = useParams();
      const context = useJuniperContext();

      return React.createElement(
        _HydrateFallback as ComponentType<HydrateFallbackProps>,
        {
          params,
          context,
        },
      );
    };
  }

  let loader: LoaderFunction<RouterContextProvider> | undefined;
  if (_loader) {
    loader = function loader(args: LoaderFunctionArgs<RouterContextProvider>) {
      const { context, params } = args;
      const request = withCachedRequest(args.request);
      const serverLoader = () => getServerLoader(request);
      const result = _loader({ context, params, request, serverLoader });
      if (HydrateFallback && result instanceof Promise) {
        return { promise: result };
      }
      return result;
    };
  } else if (hasServerLoader) {
    loader = function loader(args: LoaderFunctionArgs<RouterContextProvider>) {
      if (HydrateFallback) {
        return { promise: getServerLoader(args.request) };
      }
      return getServerLoader(args.request);
    };
  }

  let action:
    | ActionFunction<RouterContextProvider>
    | undefined;

  if (_action) {
    action = function action(args: ActionFunctionArgs<RouterContextProvider>) {
      const { context, params } = args;
      const request = withCachedRequest(args.request);
      const serverAction = () => getServerAction(request);
      return _action({ context, params, request, serverAction });
    };
  } else if (hasServerAction) {
    action = function action(args: ActionFunctionArgs<RouterContextProvider>) {
      const request = withCachedRequest(args.request);
      return getServerAction(request);
    };
  }

  const hasClientLoader = !!_loader;
  const hasAsyncLoader = HydrateFallback &&
    (hasClientLoader || hasServerLoader);

  let Component: ComponentType | undefined;
  if (_Component) {
    Component = function Component() {
      const params = useParams();
      const loaderData = useLoaderData();
      const actionData = useActionData();
      const context = useJuniperContext();

      if (hasAsyncLoader && HydrateFallback) {
        if (loaderData == null) {
          return <HydrateFallback />;
        }
        const hasPromise = typeof loaderData === "object" &&
          "promise" in loaderData;
        if (hasPromise) {
          return (
            <Suspense fallback={<HydrateFallback />}>
              <Await resolve={loaderData.promise}>
                {(resolvedLoaderData) => (
                  <_Component
                    params={params}
                    loaderData={resolvedLoaderData}
                    actionData={actionData}
                    context={context}
                  />
                )}
              </Await>
            </Suspense>
          );
        }
      }

      return React.createElement(
        _Component as ComponentType<RouteProps>,
        {
          params,
          loaderData,
          actionData,
          context,
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
      const context = useJuniperContext();

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
          context,
        },
      );
    };
  }

  let middleware:
    | ReactRouterMiddlewareFunction<RouterContextProvider>[]
    | undefined;
  if (_middleware && _middleware.length > 0) {
    middleware = _middleware.map((mw: MiddlewareFunction) => {
      const wrappedMiddleware: ReactRouterMiddlewareFunction<
        RouterContextProvider
      > = (
        args,
        next,
      ) => {
        return mw(
          {
            context: args.context as RouterContextProvider,
            params: args.params,
            request: args.request,
          },
          next,
        );
      };
      return wrappedMiddleware;
    });
  }

  return {
    Component,
    ErrorBoundary,
    HydrateFallback,
    loader,
    action,
    middleware,
  };
}

/**
 * Creates a lazy route object that loads a `RouteModule` and converts it to a route object.
 * Note: Middleware cannot be lazily loaded per React Router constraints, so it is stripped.
 *
 * @param lazyRouteFile - The lazy route file to create a lazy route object from.
 * @param serverFlags - Flags indicating whether the route has server-side loader/action.
 * @param routeId - The route ID used for server data requests.
 * @param deserializeError - Optional custom error deserializer for server errors.
 * @returns A lazy route object.
 */
export function createLazyRoute(
  lazyRouteFile: () => Promise<RouteModule>,
  serverFlags?: ServerFlags,
  routeId?: string,
  deserializeError?: (serializedError: unknown) => unknown,
): LazyRoute {
  return async (): Promise<LazyRouteResult> => {
    const routeFile = await lazyRouteFile();
    const { middleware: _middleware, ...rest } = createRoute(
      routeFile,
      serverFlags,
      routeId,
      deserializeError,
    );
    return rest;
  };
}
