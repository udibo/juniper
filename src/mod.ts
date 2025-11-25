import type { ReactElement } from "react";
import type {
  ActionFunctionArgs as RouteActionArgsBase,
  LoaderFunctionArgs as RouteLoaderArgsBase,
  RouterContextProvider,
} from "react-router";

export type AnyParams = Record<string, string | undefined>;

/**
 * The argument shape provided to route loaders.
 *
 * @template Context - The router context type.
 */
export type RouteLoaderArgs<
  Context extends RouterContextProvider = RouterContextProvider,
> = RouteLoaderArgsBase<Context>;

/**
 * The argument shape provided to route actions.
 *
 * @template Context - The router context type.
 */
export type RouteActionArgs<
  Context extends RouterContextProvider = RouterContextProvider,
> = RouteActionArgsBase<Context>;

/**
 * The props that are common to route components and error boundaries.
 *
 * @template Params - The type of route params. Defaults to `AnyParams`.
 * @template LoaderData - The type of loader data. Defaults to `unknown`.
 * @template ActionData - The type of action data. Defaults to `unknown`.
 *
 * @example Basic route component without loader or params
 * ```ts
 * import type { RouteProps } from "@udibo/juniper";
 *
 * export default function AboutPage({ params, loaderData, actionData }: RouteProps) {
 *   // params, loaderData, and actionData are available but typed as unknown/AnyParams
 *   return <div>About</div>;
 * }
 * ```
 *
 * @example Route component with loader data
 * ```ts
 * import type { RouteProps, AnyParams } from "@udibo/juniper";
 *
 * interface BlogIndexLoaderData {
 *   posts: Post[];
 *   cursor: string;
 * }
 *
 * export default function BlogIndex({ loaderData }: RouteProps<AnyParams, BlogIndexLoaderData>) {
 *   // loaderData is typed as BlogIndexLoaderData
 *   const { posts, cursor } = loaderData;
 *   return <div>{posts.map(post => <div key={post.id}>{post.title}</div>)}</div>;
 * }
 * ```
 *
 * @example Route component with params
 * ```ts
 * import type { RouteProps } from "@udibo/juniper";
 *
 * export default function BlogPost({ params }: RouteProps<{ id: string }>) {
 *   // params.id is typed as string | undefined
 *   return <div>Post {params.id}</div>;
 * }
 * ```
 *
 * @example Route component with loader data and params
 * ```ts
 * import type { RouteProps } from "@udibo/juniper";
 *
 * interface BlogPostLoaderData {
 *   post: Post;
 * }
 *
 * export default function BlogPost(
 *   { params, loaderData }: RouteProps<{ id: string }, BlogPostLoaderData>
 * ) {
 *   // params.id is typed as string | undefined
 *   // loaderData is typed as BlogPostLoaderData
 *   const { post } = loaderData;
 *   return <div>{post.title}</div>;
 * }
 * ```
 *
 * @example Route component with action data
 * ```ts
 * import type { RouteProps, AnyParams } from "@udibo/juniper";
 *
 * interface ActionResult {
 *   success: boolean;
 *   message: string;
 * }
 *
 * export default function ContactForm(
 *   { actionData }: RouteProps<AnyParams, unknown, ActionResult>
 * ) {
 *   // actionData is typed as ActionResult
 *   if (actionData?.success) {
 *     return <div>Success: {actionData.message}</div>;
 *   }
 *   return <form><input type="text" /></form>;
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
  /** The action data of the route. */
  actionData: ActionData;
}

/**
 * The props for error boundary components.
 *
 * @example With loader data and params
 * ```ts
 * interface BlogPostLoaderData {
 *   post: Post;
 * }
 *
 * export function ErrorBoundary(
 *   { error, params, loaderData }: ErrorBoundaryProps<{ id: string }, BlogPostLoaderData>
 * ) {
 *   // params.id is typed as string | undefined
 *   // loaderData is typed as BlogPostLoaderData
 * }
 * ```
 *
 * @example With loader data but no param types needed
 * ```ts
 * import type { AnyParams } from "@udibo/juniper";
 *
 * interface BlogPostLoaderData {
 *   post: Post;
 * }
 *
 * export function ErrorBoundary(
 *   { error, loaderData }: ErrorBoundaryProps<AnyParams, BlogPostLoaderData>
 * ) {
 *   // loaderData is typed as BlogPostLoaderData
 *   // params is typed as AnyParams (no specific param types needed)
 * }
 * ```
 *
 * @example With only action data and no param types needed
 * ```ts
 * import type { AnyParams } from "@udibo/juniper";
 *
 * interface ActionResult {
 *   success: boolean;
 *   message: string;
 * }
 *
 * export function ErrorBoundary(
 *   { error, actionData }: ErrorBoundaryProps<AnyParams, unknown, ActionResult>
 * ) {
 *   // actionData is typed as ActionResult
 *   // loaderData is unknown
 *   // params is typed as AnyParams (no specific param types needed)
 * }
 * ```
 *
 * @example With both loader and action data
 * ```ts
 * interface BlogPostLoaderData {
 *   post: Post;
 * }
 *
 * interface ActionResult {
 *   success: boolean;
 * }
 *
 * export function ErrorBoundary(
 *   { error, loaderData, actionData }: ErrorBoundaryProps<
 *     { id: string },
 *     BlogPostLoaderData,
 *     ActionResult
 *   >
 * ) {
 *   // loaderData is typed as BlogPostLoaderData
 *   // actionData is typed as ActionResult
 * }
 * ```
 *
 * @template Params - The type of route params. Defaults to `AnyParams`.
 * @template LoaderData - The type of loader data. Defaults to `unknown`.
 * @template ActionData - The type of action data. Defaults to `unknown`.
 */
export interface ErrorBoundaryProps<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
> extends RouteProps<Params, LoaderData, ActionData> {
  /** The error that was thrown. */
  error: unknown;
  /** A function to reset the error boundary. */
  resetErrorBoundary: () => void;
}

/** A React component used for a route. */
type BivariantComponent<Props> = {
  bivarianceHack(props: Props): ReactElement | null;
}["bivarianceHack"];

export type RouteComponent<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
> = BivariantComponent<RouteProps<Params, LoaderData, ActionData>>;

/** A React component used for a route's error boundary. */
export type RouteErrorBoundary<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
> = BivariantComponent<ErrorBoundaryProps<Params, LoaderData, ActionData>>;

/**
 * A loader function exported by a route module.
 *
 * @template Context - The router context type.
 * @template LoaderData - The loader return value type.
 */
export type LoaderFunction<
  Context extends RouterContextProvider = RouterContextProvider,
  LoaderData = unknown,
> = (
  args: RouteLoaderArgs<Context>,
) => LoaderData | Promise<LoaderData>;

/**
 * An action function exported by a route module.
 *
 * @template Context - The router context type.
 * @template ActionData - The action return value type.
 */
export type ActionFunction<
  Context extends RouterContextProvider = RouterContextProvider,
  ActionData = unknown,
> = (
  args: RouteActionArgs<Context>,
) => ActionData | Promise<ActionData>;

/**
 * The contract for a route module file.
 *
 * @template Params - The type of route params.
 * @template LoaderData - The loader return value type.
 * @template ActionData - The action return value type.
 * @template Context - The router context type.
 */
export interface RouteModule<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
  Context extends RouterContextProvider = RouterContextProvider,
> {
  /** The route's component. */
  default?: RouteComponent<Params, LoaderData, ActionData>;
  /** The route's error boundary component. */
  ErrorBoundary?: RouteErrorBoundary<Params, LoaderData, ActionData>;
  /** The route's hydration fallback component. */
  HydrateFallback?: RouteComponent<Params, LoaderData, ActionData>;
  /** The loader function. */
  loader?: LoaderFunction<Context, LoaderData>;
  /** The action function. */
  action?: ActionFunction<Context, ActionData>;
}

/**
 * The contract for the root route module.
 *
 * @template Params - The type of route params.
 * @template LoaderData - The loader return value type.
 * @template ActionData - The action return value type.
 * @template Context - The router context type.
 */
export interface RootRouteModule<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
  Context extends RouterContextProvider = RouterContextProvider,
> extends RouteModule<Params, LoaderData, ActionData, Context> {
  /**
   * Extends the default error deserialization used on the client when rehydrating errors
   * thrown by loaders or actions on the server.
   */
  deserializeError?: (serializedError: unknown) => unknown;
}
