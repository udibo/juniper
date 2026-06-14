import { HttpError } from "@udibo/http-error";
import {
  Await,
  isRouteErrorResponse,
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
  LoaderFunction,
  LoaderFunctionArgs,
  MiddlewareFunction as ReactRouterMiddlewareFunction,
  RouterContextProvider,
} from "react-router";
import React, { createContext, Suspense, useContext } from "react";
import type { ComponentType } from "react";
import { delay } from "@std/async/delay";

import {
  deserializeError,
  deserializeHydrationData,
  deserializeLoaderData,
  deserializeStreamingLoaderData,
  type HydrationData,
  type SerializedHydrationData,
} from "./_serialization.ts";

import type {
  ErrorBoundaryProps,
  HydrateFallbackProps,
  MiddlewareFunction,
  RouteModule,
  RouteProps,
} from "./mod.ts";

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

/**
 * Flags indicating which server-side handlers a route file exports.
 *
 * Set by the build system so the client knows whether to call the route's
 * server loader/action over the network during navigation.
 */
export interface ServerFlags {
  /** Whether the route exports a server-side `loader`. */
  loader?: boolean;
  /** Whether the route exports a server-side `action`. */
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

export {
  deserializeHydrationData,
  type HydrationData,
  type SerializedHydrationData,
};

/** The globals available in the browser for the application. */
export type ClientGlobals = {
  /** The Juniper application's hydration data. */
  __juniperHydrationData?: SerializedHydrationData;
};

export interface AppProps {
  children: React.ReactNode;
  htmlProps?: React.HTMLAttributes<HTMLHtmlElement>;
}

export function App({ children, htmlProps }: AppProps) {
  return (
    <html lang="en" suppressHydrationWarning {...htmlProps}>
      <head>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

const MAX_RELOAD_RETRIES = 2;
const RELOAD_WINDOW_MS = 30000;

interface ReloadState {
  count: number;
  timestamp: number;
}

function getReloadState(key: string): ReloadState {
  try {
    const stored = sessionStorage.getItem(key);
    if (!stored) return { count: 0, timestamp: 0 };
    return JSON.parse(stored);
  } catch {
    return { count: 0, timestamp: 0 };
  }
}

function shouldReload(key: string): boolean {
  const { count, timestamp } = getReloadState(key);
  const now = Date.now();

  if (now - timestamp > RELOAD_WINDOW_MS) return true;

  return count < MAX_RELOAD_RETRIES;
}

function recordReload(key: string): void {
  const { count, timestamp } = getReloadState(key);
  const now = Date.now();

  if (now - timestamp > RELOAD_WINDOW_MS) {
    sessionStorage.setItem(
      key,
      JSON.stringify({ count: 1, timestamp: now }),
    );
  } else {
    sessionStorage.setItem(
      key,
      JSON.stringify({ count: count + 1, timestamp }),
    );
  }
}

function clearReloadState(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const LAZY_LOAD_RELOAD_KEY = "__juniper_lazy_load_reload";
const SAME_LOCATION_RELOAD_KEY = "__juniper_same_location_reload";

// Never settles, so React Router stays pending during a full-page navigation/reload; resolving would render the destination route for a frame and flash the wrong page.
function holdForDocumentNavigation(): Promise<never> {
  return new Promise<never>(() => {});
}

async function fetchServerData(
  request: Request,
  method: "GET" | "POST",
  routeId: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "X-Juniper-Route-Id": routeId,
  };

  const fetchOptions: RequestInit = { method, headers };
  if (method === "POST") {
    fetchOptions.body = await request.formData();
  }

  const response = await fetch(request.url, fetchOptions);

  const contentType = response.headers.get("Content-Type");

  if (contentType === "application/cbor-stream") {
    if (!response.ok) {
      const buffer = await response.arrayBuffer();
      const deserialized = deserializeLoaderData(new Uint8Array(buffer));
      throw deserializeError(deserialized as Record<string, unknown>);
    }
    return await deserializeStreamingLoaderData(response);
  }

  if (contentType === "application/cbor") {
    const buffer = await response.arrayBuffer();
    const deserialized = deserializeLoaderData(new Uint8Array(buffer));

    if (!response.ok) {
      throw deserializeError(deserialized as Record<string, unknown>);
    }

    return deserialized;
  }

  const responseType = response.headers.get("X-Juniper");
  if (responseType === "redirect") {
    const redirectData = await response.json();
    const location = redirectData.location;
    const currentUrl = new URL(globalThis.location.href);
    const redirectUrl = new URL(location, currentUrl);

    // `redirectDocument()` needs a real browser navigation; a client-side transition would 404 on the server-only route.
    if (redirectData.reloadDocument) {
      delay(0).then(() => {
        globalThis.location.assign(redirectUrl.href);
      });
      return holdForDocumentNavigation();
    }

    if (redirectUrl.href === currentUrl.href) {
      if (shouldReload(SAME_LOCATION_RELOAD_KEY)) {
        recordReload(SAME_LOCATION_RELOAD_KEY);
        delay(0).then(() => {
          globalThis.location.reload();
        });
        return holdForDocumentNavigation();
      }
      return undefined;
    }

    clearReloadState(SAME_LOCATION_RELOAD_KEY);
    throw redirect(location);
  }

  if (!response.ok) {
    throw await HttpError.from(response);
  }

  return response;
}

function fetchServerLoader(
  request: Request,
  routeId: string,
): Promise<unknown> {
  return fetchServerData(request, "GET", routeId);
}

function fetchServerAction(
  request: Request,
  routeId: string,
): Promise<unknown> {
  return fetchServerData(request, "POST", routeId);
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
 * @returns A concrete `Route` instance.
 */
export function createRoute(
  routeFile: RouteModule,
  serverFlags?: ServerFlags,
  routeId?: string,
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
    return fetchServerLoader(request, routeId);
  }

  function getServerAction(request: Request) {
    if (!hasServerAction) {
      throw new Error("Server action not available for this route");
    }
    if (!routeId) {
      throw new Error("Route ID is required to fetch server action data");
    }
    return fetchServerAction(request, routeId);
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
      const routeError = useRouteError();
      const navigate = useNavigate();
      const location = useLocation();
      const context = useJuniperContext();

      let error: unknown = routeError;
      if (isRouteErrorResponse(routeError)) {
        const message = typeof routeError.data === "string"
          ? routeError.data
          : routeError.statusText;
        error = new HttpError(routeError.status, message);
      }

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
 * @returns A lazy route object.
 */
export function createLazyRoute(
  lazyRouteFile: () => Promise<RouteModule>,
  serverFlags?: ServerFlags,
  routeId?: string,
): LazyRoute {
  return async (): Promise<LazyRouteResult> => {
    let routeFile: RouteModule;
    try {
      routeFile = await lazyRouteFile();
      clearReloadState(LAZY_LOAD_RELOAD_KEY);
    } catch (error) {
      if (shouldReload(LAZY_LOAD_RELOAD_KEY)) {
        recordReload(LAZY_LOAD_RELOAD_KEY);
        delay(0).then(() => {
          globalThis.location.reload();
        });
      }
      throw error;
    }
    const { middleware: _, ...rest } = createRoute(
      routeFile,
      serverFlags,
      routeId,
    );
    return rest;
  };
}
