/**
 * Route contracts, serialization registration, and HTTP errors for Juniper.
 *
 * Components receive data through props. Server-only handlers belong in paired
 * `.ts` files; `.tsx` modules must be safe to import in the browser.
 *
 * @module
 */
import type { ReactElement } from "react";
import type { RouterContext } from "react-router";
import {
  redirect,
  redirectDocument,
  RouterContextProvider,
} from "react-router";
import { HttpError } from "@udibo/http-error";

import {
  _addContextSerializer,
  _addErrorSerializer,
  _addTypeSerializer,
} from "./_serialization.ts";

export { HttpError, RouterContextProvider };

/**
 * The router context passed to loaders, actions, middleware, and components.
 *
 * Use `get` and `set` with keys from React Router's `createContext`. Readonly
 * prevents replacing provider members; stored values remain mutable. Server
 * providers are request-scoped. The browser provider survives navigations, so
 * context is not a substitute for reactive React state.
 *
 * @example
 * ```ts
 * import { createContext } from "react-router";
 * import type { RequestContext } from "@udibo/juniper";
 * const locale = createContext("en");
 * export function readLocale(context: RequestContext): string {
 *   return context.get(locale);
 * }
 * ```
 */
export type RequestContext = Readonly<RouterContextProvider>;

/**
 * React Router's redirect helpers, re-exported so routes can choose the
 * redirect kind from one import: {@linkcode redirect} for a client-side (SPA)
 * transition, {@linkcode redirectDocument} for a full-page navigation (the
 * right choice when the target is a server-only route the client router can't
 * render). Both work whether thrown from a loader/action or returned from a
 * Hono handler/middleware.
 */
export { redirect, redirectDocument };

/**
 * A serializer for custom types that need to be transferred between server and client.
 *
 * Use this interface with {@linkcode registerType} to register custom classes or objects
 * that should be serialized in loader/action data.
 * Register types such as `Map`, `Set`, `RegExp`, and `URL` explicitly; the route
 * data preprocessor does not preserve unregistered class instances. `Date` and
 * errors have built-in handling. Bigints are accepted, but safe integer values
 * can decode as numbers; use an explicit representation when that type matters.
 *
 * @template T - The type being serialized
 * @template S - The serialized representation type (defaults to `unknown`)
 *
 * @example Registering a custom Money class
 * ```ts
 * import { registerType, type TypeSerializer } from "@udibo/juniper";
 *
 * class Money {
 *   constructor(public amount: number, public currency: string) {}
 * }
 *
 * registerType<Money, { amount: number; currency: string }>({
 *   name: "Money",
 *   is: (value): value is Money => value instanceof Money,
 *   serialize: (money) => ({ amount: money.amount, currency: money.currency }),
 *   deserialize: (data) => new Money(data.amount, data.currency),
 * });
 * ```
 */
export interface TypeSerializer<T, S = unknown> {
  /** Unique name identifying this type. Used in serialized data to identify the type. */
  name: string;
  /** Type guard function that returns true if the value is of this type. */
  is: (value: unknown) => value is T;
  /** Converts the value to its serialized representation. */
  serialize: (value: T) => S;
  /** Reconstructs the original value from its serialized representation. */
  deserialize: (data: S) => T;
}

/**
 * A serializer for custom error types that need to be transferred between server and client.
 *
 * Use with {@linkcode registerError} to preserve custom types in SSR hydration,
 * explicitly returned error data, and deferred promise rejections. Immediate
 * failures of server loader/action data requests are normalized to `HttpError`
 * before serialization and do not preserve a custom error class.
 *
 * @template E - The error type being serialized (must extend Error)
 *
 * @example Registering a ValidationError
 * ```ts
 * import { registerError, type ErrorSerializer } from "@udibo/juniper";
 *
 * class ValidationError extends Error {
 *   constructor(message: string, public fields: string[]) {
 *     super(message);
 *     this.name = "ValidationError";
 *   }
 * }
 *
 * registerError<ValidationError>({
 *   name: "ValidationError",
 *   is: (error): error is ValidationError => error instanceof ValidationError,
 *   serialize: (error) => ({
 *     message: error.message,
 *     fields: error.fields,
 *   }),
 *   deserialize: (data) => new ValidationError(
 *     data.message as string,
 *     data.fields as string[],
 *   ),
 * });
 * ```
 */
export interface ErrorSerializer<E extends Error> {
  /** Unique name identifying this error type. Used in serialized data to identify the error. */
  name: string;
  /** Type guard function that returns true if the error is of this type. */
  is: (error: unknown) => error is E;
  /** Converts the error to a plain object representation. */
  serialize: (error: E) => Record<string, unknown>;
  /** Reconstructs the error from its serialized representation. */
  deserialize: (data: Record<string, unknown>) => E;
}

/**
 * A serializer for React Router context values that need to be transferred from server to client.
 *
 * Use this interface with {@linkcode registerContext} to register context values
 * that should be available on both server and client during hydration.
 *
 * @template T - The context value type
 * @template S - The serialized representation type (defaults to `unknown`)
 *
 * @example Registering a user context
 * ```ts
 * import { createContext } from "react-router";
 * import { registerContext, type ContextSerializer } from "@udibo/juniper";
 *
 * interface User {
 *   id: string;
 *   name: string;
 *   role: "admin" | "user";
 * }
 *
 * const userContext = createContext<User | null>();
 *
 * registerContext<User | null, User | null>({
 *   name: "user",
 *   context: userContext,
 *   serialize: (user) => user,
 *   deserialize: (data) => data ?? null,
 * });
 * ```
 */
export interface ContextSerializer<T, S = unknown> {
  /** Unique name identifying this context. Used in serialized data to identify the context. */
  name: string;
  /** The React Router context object created with createContext(). */
  context: RouterContext<T>;
  /** Converts the context value to its serialized representation. */
  serialize: (value: T) => S;
  /** Reconstructs the context value from its serialized representation. */
  deserialize: (data: S | undefined) => T;
}

/**
 * Registers a custom value's wire representation for loader and action data.
 *
 * Call once at module scope in a shared module imported by both server and client.
 * Registrations are process-wide. The first matching type guard wins; keep guards
 * narrow and names stable. Both ends must agree on the name and representation.
 *
 * @param serializer - Synchronous type guard, encoder, and decoder.
 * @throws {Error} If this type name is already registered.
 * @example
 * ```ts
 * import { registerType } from "@udibo/juniper";
 * class Point {
 *   constructor(public x: number, public y: number) {}
 * }
 * registerType<Point, { x: number; y: number }>({
 *   name: "Point",
 *   is: (value): value is Point => value instanceof Point,
 *   serialize: ({ x, y }) => ({ x, y }),
 *   deserialize: ({ x, y }) => new Point(x, y),
 * });
 * ```
 */
export function registerType<T, S = unknown>(
  serializer: TypeSerializer<T, S>,
): void {
  _addTypeSerializer(serializer);
}

/**
 * Registers a custom error's browser-visible representation.
 *
 * Import the registration on both server and client before routes run. Serialize
 * only fields safe for the user to read: Juniper does not redact custom payloads.
 * Built-in errors and `HttpError` already have serializers; give each custom
 * error a distinct name.
 *
 * @param serializer - Synchronous encoder and decoder for a specific error class.
 * @throws {Error} If this error name is already registered.
 * @example
 * ```ts
 * import { registerError } from "@udibo/juniper";
 * class InvalidField extends Error {
 *   constructor(public field: string) { super("Invalid field"); }
 * }
 * registerError<InvalidField>({
 *   name: "InvalidField",
 *   is: (error): error is InvalidField => error instanceof InvalidField,
 *   serialize: (error) => ({ field: error.field }),
 *   deserialize: (data) => new InvalidField(String(data.field)),
 * });
 * ```
 */
export function registerError<E extends Error>(
  serializer: ErrorSerializer<E>,
): void {
  _addErrorSerializer(serializer);
}

/**
 * Includes a context value in initial server-to-browser hydration data.
 *
 * Register once in a shared module imported on both sides. Treat `serialize` as an
 * allowlist: its result is readable in the document, even when no component displays
 * it. Never include credentials or private server state. Hydration seeds browser
 * context; later server requests do not synchronize it. The decoder must handle
 * `undefined` when no value was serialized.
 *
 * @param serializer - Context key and synchronous wire conversions.
 * @throws {Error} If this context name is already registered.
 * @example
 * ```ts
 * import { createContext } from "react-router";
 * import { registerContext } from "@udibo/juniper";
 * export const localeContext = createContext("en");
 * registerContext<string, string>({
 *   name: "locale",
 *   context: localeContext,
 *   serialize: (locale) => locale,
 *   deserialize: (locale) => locale ?? "en",
 * });
 * ```
 */
export function registerContext<T, S = unknown>(
  serializer: ContextSerializer<T, S>,
): void {
  _addContextSerializer(serializer);
}

/**
 * Default route parameters, whose values may be absent.
 *
 * Use this when specifying data types without a custom parameter shape. Validate
 * optional and catch-all parameters before use.
 *
 * @example
 * ```tsx
 * import type { AnyParams, RouteProps } from "@udibo/juniper";
 * type Data = { title: string };
 * export default function Page({ loaderData }: RouteProps<AnyParams, Data>) {
 *   return <h1>{loaderData.title}</h1>;
 * }
 * ```
 */
export type AnyParams = Record<string, string | undefined>;

/**
 * Arguments passed to a route's `loader` export.
 *
 * A `.ts` loader runs on the server. A `.tsx` loader runs during browser navigation
 * and also during SSR when no paired server loader exists. Only a browser loader
 * with a paired server loader can call `serverLoader()`; on the server it throws.
 * Forward `request.signal` to your own fetches to respect navigation cancellation.
 *
 * @example
 * ```ts
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 * export function loader({ request }: RouteLoaderArgs): { query: string } {
 *   return { query: new URL(request.url).searchParams.get("q") ?? "" };
 * }
 * ```
 */
export interface RouteLoaderArgs<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
> {
  /** The request-scoped router context, shared across middleware, loaders, and actions. */
  context: RequestContext;
  /** The matched route params. */
  params: Params;
  /** The incoming request. */
  request: Request;
  /**
   * Calls the route's server loader from a client loader, resolving its data
   * (or a `Response`). Only meaningful in a client loader paired with a server
   * loader; on the server it throws.
   */
  serverLoader: () => LoaderData | Response | Promise<LoaderData | Response>;
}

/**
 * Arguments passed to a route's `action` export.
 *
 * Read fields with `request.formData()` and validate their runtime types. A browser
 * action can invoke its paired server action with `serverAction()`; the server-side
 * argument rejects that call. Throw redirects to leave the normal data path.
 *
 * @example
 * ```ts
 * import type { RouteActionArgs } from "@udibo/juniper";
 * export async function action({ request }: RouteActionArgs): Promise<{ error?: string }> {
 *   const name = (await request.formData()).get("name");
 *   return typeof name === "string" && name.trim() ? {} : { error: "Name is required" };
 * }
 * ```
 */
export interface RouteActionArgs<
  Params extends AnyParams = AnyParams,
  ActionData = unknown,
> {
  /** The request-scoped router context, shared across middleware, loaders, and actions. */
  context: RequestContext;
  /** The matched route params. */
  params: Params;
  /** The incoming request. */
  request: Request;
  /**
   * Calls the route's server action from a client action, resolving its data
   * (or a `Response`). Only meaningful in a client action paired with a server
   * action; on the server it throws.
   */
  serverAction: () => ActionData | Response | Promise<ActionData | Response>;
}

/**
 * Arguments supplied to browser route middleware.
 *
 * Context is shared with downstream loaders and actions. Server authorization
 * belongs in Hono middleware in a `.ts` route. See {@linkcode MiddlewareFunction}
 * for ordering, limitations, and an example.
 */
export interface RouteMiddlewareArgs<
  Params extends AnyParams = AnyParams,
> {
  /** The request-scoped router context, shared across middleware, loaders, and actions. */
  context: RequestContext;
  /** The matched route params. */
  params: Params;
  /** The incoming request. */
  request: Request;
}

/**
 * Browser middleware around a navigation's loaders and actions.
 *
 * Await `next()` to wrap downstream work, or omit it for a before-only check.
 * Throw to stop processing. These functions do not run during SSR. Lazy route
 * modules do not install middleware; put browser middleware in the eagerly loaded
 * root `routes/main.tsx` and enforce authorization in server Hono middleware.
 *
 * @example
 * ```ts
 * import type { MiddlewareFunction } from "@udibo/juniper";
 * export const middleware: MiddlewareFunction[] = [
 *   async ({ request }, next) => {
 *     const started = performance.now();
 *     await next();
 *     console.info(request.url, performance.now() - started);
 *   },
 * ];
 * ```
 */
export type MiddlewareFunction<
  Params extends AnyParams = AnyParams,
> = (
  args: RouteMiddlewareArgs<Params>,
  next: () => Promise<RequestContext>,
) => Promise<void> | void;

/**
 * Data supplied directly to a route component by Juniper.
 *
 * Use props instead of React Router's data hooks, which can expose the internal
 * deferred-data wrapper. Action data is absent before a navigation submission
 * completes; include `undefined` in its type. A fetcher publishes to `fetcher.data`
 * instead of this prop.
 *
 * @example
 * ```tsx
 * import { Form } from "react-router";
 * import type { AnyParams, RouteProps } from "@udibo/juniper";
 * type Data = { title: string };
 * type Result = { error?: string } | undefined;
 * export default function Page({ loaderData, actionData }: RouteProps<AnyParams, Data, Result>) {
 *   return <Form method="post">
 *     <h1>{loaderData.title}</h1>
 *     <label>Name<input name="name" /></label>
 *     {actionData?.error && <p role="alert">{actionData.error}</p>}
 *     <button type="submit">Save</button>
 *   </Form>;
 * }
 * ```
 */
export interface RouteProps<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
> {
  /** The params of the route. */
  params: Params;
  /** The loader data of the route. */
  loaderData: LoaderData;
  /** Result of a navigation submission, or undefined before one completes. */
  actionData: ActionData;
  /** The router context shared by middleware, loaders, actions, and components. */
  context: RequestContext;
}

/**
 * Props for the nearest route `ErrorBoundary` handling a failure.
 *
 * Loader and action data may be absent even when the normal component requires
 * them. A middleware denial renders without executing loaders. Preserve useful
 * navigation and display a safe message rather than an arbitrary exception.
 * Outside development, unexpected built-in or unregistered server `Error`
 * failures become generic 500 errors. `HttpError` uses its exposure policy;
 * custom serializers and explicitly returned error data remain application-owned.
 *
 * @example
 * ```tsx
 * import { HttpError, type ErrorBoundaryProps } from "@udibo/juniper";
 * export function ErrorBoundary({ error, resetErrorBoundary }: ErrorBoundaryProps) {
 *   const message = error instanceof HttpError ? error.exposedMessage : "Something went wrong";
 *   return <div role="alert">
 *     <p>{message}</p>
 *     <button type="button" onClick={resetErrorBoundary}>Try again</button>
 *   </div>;
 * }
 * ```
 */
export interface ErrorBoundaryProps<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
> extends RouteProps<Params, LoaderData, ActionData> {
  /** The failure, with server error details sanitized outside development. */
  error: unknown;
  /** Retries the current URL, including query and fragment; failed imports require document navigation. */
  resetErrorBoundary: () => void;
}

/**
 * A React component type for a route export, with props compared bivariantly
 * so route components stay assignable regardless of prop variance.
 */
export type BivariantComponent<Props> = {
  bivarianceHack(props: Props): ReactElement | null;
}["bivarianceHack"];

/**
 * Props available while a route waits for its loader result.
 *
 * Only params and context are supplied; loader and action data are absent. See
 * {@linkcode HydrateFallbackComponent} for when the fallback renders.
 */
export interface HydrateFallbackProps<
  Params extends AnyParams = AnyParams,
> {
  /** The params of the route. */
  params: Params;
  /** The router context shared by middleware, loaders, actions, and components. */
  context: RequestContext;
}

/**
 * A route fallback for pending loader data.
 *
 * Juniper also uses this export during browser navigation when a loader returns a
 * promise. It can replace route content during revalidation. It cannot display
 * feedback while its own module downloads; use `useNavigation()` in a mounted
 * layout for that interval. For one deferred section use `Suspense` and `Await`.
 *
 * Keep loaders that decide redirects blocking: a redirect thrown or returned by
 * an async loader deferred through this fallback does not trigger router
 * navigation. Omit this export on those loaders and use mounted navigation UI.
 *
 * @example
 * ```tsx
 * export function HydrateFallback() {
 *   return <p role="status">Loading article…</p>;
 * }
 * ```
 */
export type HydrateFallbackComponent<
  Params extends AnyParams = AnyParams,
> = BivariantComponent<HydrateFallbackProps<Params>>;

/**
 * Component type for a route module's default export.
 *
 * Type page data with {@linkcode RouteProps}. A `main.tsx` layout renders an
 * `Outlet` where its child belongs.
 *
 * @example
 * ```tsx
 * import { Outlet } from "react-router";
 * export default function Layout() { return <main><Outlet /></main>; }
 * ```
 */
export type RouteComponent<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
> = BivariantComponent<RouteProps<Params, LoaderData, ActionData>>;

/**
 * Component type for a route's `ErrorBoundary` export.
 *
 * Errors bubble to the nearest ancestor boundary. See {@linkcode ErrorBoundaryProps}
 * for a safe example and data availability during recovery.
 */
export type RouteErrorBoundary<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
> = BivariantComponent<
  ErrorBoundaryProps<Params, LoaderData, ActionData>
>;

/**
 * Loader export accepted by a Juniper route module.
 *
 * Return ready data or a promise for it. An object containing promises defers
 * individual fields; consume them with `Suspense` and `Await`. Throw an `HttpError`
 * or redirect to leave the data path. See {@linkcode RouteLoaderArgs} for execution
 * and {@linkcode HydrateFallbackComponent} for pending UI.
 *
 * @example
 * ```ts
 * import type { LoaderFunction } from "@udibo/juniper";
 * export const loader: LoaderFunction = () => ({
 *   title: "Activity",
 *   items: Promise.resolve(["Created account"]),
 * });
 * ```
 */
export type LoaderFunction<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
> = {
  bivarianceHack(
    args: RouteLoaderArgs<Params, LoaderData>,
  ): LoaderData | Promise<LoaderData>;
}["bivarianceHack"];

/**
 * Action export accepted by a Juniper route module.
 *
 * Return serializable data for the submitting form, or throw a redirect/error.
 * See {@linkcode RouteActionArgs} for request parsing and the server-action bridge.
 *
 * @example
 * ```ts
 * import { redirect, type ActionFunction } from "@udibo/juniper";
 * export const action: ActionFunction = () => { throw redirect("/complete"); };
 * ```
 */
export type ActionFunction<
  Params extends AnyParams = AnyParams,
  ActionData = unknown,
> = {
  bivarianceHack(
    args: RouteActionArgs<Params, ActionData>,
  ): ActionData | Promise<ActionData>;
}["bivarianceHack"];

/**
 * Exports supported by a `.tsx` page or layout module.
 *
 * Juniper adapts components to receive props and connects paired `.ts` loaders and
 * actions. This module can be bundled into the browser; keep server-only imports
 * in its paired `.ts` file. Consult individual export contracts for pending data,
 * errors, and middleware limitations.
 *
 * @example
 * ```tsx
 * import type { RouteModule } from "@udibo/juniper";
 * const page = {
 *   default: () => <h1>About</h1>,
 *   ErrorBoundary: () => <p role="alert">Unable to load this page</p>,
 * } satisfies RouteModule;
 * export default page.default;
 * export const ErrorBoundary = page.ErrorBoundary;
 * ```
 */
export interface RouteModule<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
> {
  /** The route's component. */
  default?: RouteComponent<Params, LoaderData, ActionData>;
  /** The route's error boundary component. */
  ErrorBoundary?: RouteErrorBoundary<Params, LoaderData, ActionData>;
  /** Pending loader UI; see HydrateFallbackComponent before using it on a layout. */
  HydrateFallback?: HydrateFallbackComponent<Params>;
  /** The loader function. */
  loader?: LoaderFunction<Params, LoaderData>;
  /** The action function. */
  action?: ActionFunction<Params, ActionData>;
  /** The middleware functions that run before loaders and actions. */
  middleware?: MiddlewareFunction<Params>[];
}

/**
 * Props that can be applied to the `<html>` element.
 * Useful for setting `lang`, `dir`, or other global HTML attributes.
 */
export type HtmlProps = React.HTMLAttributes<HTMLHtmlElement>;

/**
 * Exports for the eagerly loaded root `routes/main.tsx` layout.
 *
 * Extends {@linkcode RouteModule} with document attributes and the browser-only
 * `beforeHydrate` hook. Put navigation in both the layout and its error boundary.
 *
 * @example
 * ```tsx
 * import { Outlet } from "react-router";
 * import type { HtmlProps } from "@udibo/juniper";
 * export const htmlProps: HtmlProps = { lang: "en" };
 * export default function Root() {
 *   return <>
 *     <meta charSet="utf-8" />
 *     <meta name="viewport" content="width=device-width, initial-scale=1" />
 *     <Outlet />
 *   </>;
 * }
 * ```
 */
export interface RootRouteModule<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
> extends RouteModule<Params, LoaderData, ActionData> {
  /**
   * Props to apply to the `<html>` element.
   * Common uses: `lang`, `dir`, `className`.
   *
   * @example
   * ```tsx
   * // routes/main.tsx
   * export const htmlProps = { lang: "en", dir: "ltr" };
   * ```
   */
  htmlProps?: HtmlProps;
  /**
   * Runs synchronously in the browser immediately before React hydration,
   * after route loading and the idle delay. Use it to capture served DOM state
   * that a component will consume when its ref attaches. It must not change
   * markup or return a promise.
   *
   * An optional idempotent cleanup runs once on fatal hydration failure or permanent
   * page departure. Caught errors and bfcache suspension do not dispose it;
   * the hook should also release resources when its own work completes.
   * A thrown error prevents hydration.
   *
   * @param document - The application document about to hydrate.
   * @returns Optional cleanup for pending work.
   * @example
   * ```tsx
   * export const initialValues = new Map<HTMLInputElement, string>();
   * export function beforeHydrate(document: Document): () => void {
   *   for (const input of document.querySelectorAll("input")) {
   *     initialValues.set(input, input.value);
   *   }
   *   return () => initialValues.clear();
   * }
   * ```
   */
  beforeHydrate?: (document: Document) => void | (() => void);
}
