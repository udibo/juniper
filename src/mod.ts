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
 *
 * @example Basic loader accessing params
 * ```tsx
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 *
 * export async function loader({ params }: RouteLoaderArgs) {
 *   const post = await getPost(params.id!);
 *   return { post };
 * }
 * ```
 *
 * @example Loader accessing request URL
 * ```tsx
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 *
 * export async function loader({ request }: RouteLoaderArgs) {
 *   const url = new URL(request.url);
 *   const query = url.searchParams.get("q") || "";
 *   const results = await search(query);
 *   return { results, query };
 * }
 * ```
 */
export type RouteLoaderArgs<
  Context extends RouterContextProvider = RouterContextProvider,
> = RouteLoaderArgsBase<Context>;

/**
 * The argument shape provided to route actions.
 *
 * @template Context - The router context type.
 *
 * @example Action handling form submission
 * ```tsx
 * import type { RouteActionArgs } from "@udibo/juniper";
 *
 * export async function action({ request }: RouteActionArgs) {
 *   const formData = await request.formData();
 *   const title = formData.get("title") as string;
 *   const content = formData.get("content") as string;
 *   const post = await createPost({ title, content });
 *   return { post };
 * }
 * ```
 *
 * @example Action with params and intent handling
 * ```tsx
 * import type { RouteActionArgs } from "@udibo/juniper";
 *
 * export async function action({ request, params }: RouteActionArgs) {
 *   const formData = await request.formData();
 *   const intent = formData.get("intent");
 *
 *   if (intent === "delete") {
 *     await deletePost(params.id!);
 *     return { deleted: true };
 *   }
 *
 *   const title = formData.get("title") as string;
 *   const post = await updatePost(params.id!, { title });
 *   return { post };
 * }
 * ```
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
 * ```tsx
 * import type { RouteProps } from "@udibo/juniper";
 *
 * export default function AboutPage({ params, loaderData, actionData }: RouteProps) {
 *   return <div>About</div>;
 * }
 * ```
 *
 * @example Route component with loader data
 * ```tsx
 * import type { RouteProps, AnyParams } from "@udibo/juniper";
 *
 * interface BlogIndexLoaderData {
 *   posts: Post[];
 *   cursor: string;
 * }
 *
 * export default function BlogIndex({ loaderData }: RouteProps<AnyParams, BlogIndexLoaderData>) {
 *   const { posts } = loaderData;
 *   return <div>{posts.map(post => <div key={post.id}>{post.title}</div>)}</div>;
 * }
 * ```
 *
 * @example Route component with params
 * ```tsx
 * import type { RouteProps } from "@udibo/juniper";
 *
 * export default function BlogPost({ params }: RouteProps<{ id: string }>) {
 *   return <div>Post {params.id}</div>;
 * }
 * ```
 *
 * @example Route component with loader data and params
 * ```tsx
 * import type { RouteProps } from "@udibo/juniper";
 *
 * interface BlogPostLoaderData {
 *   post: Post;
 * }
 *
 * export default function BlogPost(
 *   { params, loaderData }: RouteProps<{ id: string }, BlogPostLoaderData>
 * ) {
 *   const { post } = loaderData;
 *   return <div>{post.title}</div>;
 * }
 * ```
 *
 * @example Route component with action data
 * ```tsx
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
 * @template Params - The type of route params. Defaults to `AnyParams`.
 * @template LoaderData - The type of loader data. Defaults to `unknown`.
 * @template ActionData - The type of action data. Defaults to `unknown`.
 *
 * @example Basic error boundary
 * ```tsx
 * import type { ErrorBoundaryProps } from "@udibo/juniper";
 *
 * export function ErrorBoundary({ error, resetErrorBoundary }: ErrorBoundaryProps) {
 *   return (
 *     <div>
 *       <h1>Something went wrong</h1>
 *       <p>{error instanceof Error ? error.message : "Unknown error"}</p>
 *       <button onClick={resetErrorBoundary}>Try again</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Error boundary with params
 * ```tsx
 * import type { ErrorBoundaryProps } from "@udibo/juniper";
 *
 * export function ErrorBoundary({ error, params }: ErrorBoundaryProps<{ id: string }>) {
 *   return (
 *     <div>
 *       <h1>Post Not Found</h1>
 *       <p>Could not find post with ID: {params.id}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Error boundary with loader data
 * ```tsx
 * import type { AnyParams, ErrorBoundaryProps } from "@udibo/juniper";
 *
 * interface BlogPostLoaderData {
 *   post: Post;
 * }
 *
 * export function ErrorBoundary(
 *   { error, loaderData }: ErrorBoundaryProps<AnyParams, BlogPostLoaderData>
 * ) {
 *   return (
 *     <div>
 *       <h1>Error loading post</h1>
 *       <p>{error instanceof Error ? error.message : "Unknown error"}</p>
 *     </div>
 *   );
 * }
 * ```
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

/**
 * A React component type used for a route's default export.
 *
 * @template Params - The type of route params. Defaults to `AnyParams`.
 * @template LoaderData - The type of loader data. Defaults to `unknown`.
 * @template ActionData - The type of action data. Defaults to `unknown`.
 *
 * @example Simple route component
 * ```tsx
 * export default function HomePage() {
 *   return <h1>Welcome</h1>;
 * }
 * ```
 *
 * @example Route component with typed props
 * ```tsx
 * import type { RouteProps } from "@udibo/juniper";
 *
 * interface LoaderData {
 *   user: { name: string };
 * }
 *
 * export default function ProfilePage({ loaderData }: RouteProps<{ id: string }, LoaderData>) {
 *   return <h1>Hello, {loaderData.user.name}</h1>;
 * }
 * ```
 *
 * @example Layout component with Outlet for nested routes
 * ```tsx
 * import { Outlet, Link } from "react-router";
 *
 * export default function DashboardLayout() {
 *   return (
 *     <div>
 *       <nav>
 *         <Link to="/dashboard">Overview</Link>
 *         <Link to="/dashboard/settings">Settings</Link>
 *       </nav>
 *       <main>
 *         <Outlet />
 *       </main>
 *     </div>
 *   );
 * }
 * ```
 */
export type RouteComponent<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
  ActionData = unknown,
> = BivariantComponent<RouteProps<Params, LoaderData, ActionData>>;

/**
 * A React component type used for a route's error boundary export.
 *
 * @template Params - The type of route params. Defaults to `AnyParams`.
 * @template LoaderData - The type of loader data. Defaults to `unknown`.
 * @template ActionData - The type of action data. Defaults to `unknown`.
 *
 * @example Error boundary component
 * ```tsx
 * import type { ErrorBoundaryProps } from "@udibo/juniper";
 *
 * export function ErrorBoundary({ error, resetErrorBoundary }: ErrorBoundaryProps) {
 *   return (
 *     <div>
 *       <h1>Error</h1>
 *       <p>{error instanceof Error ? error.message : "Unknown error"}</p>
 *       <button onClick={resetErrorBoundary}>Retry</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Error boundary with params
 * ```tsx
 * import type { ErrorBoundaryProps } from "@udibo/juniper";
 *
 * export function ErrorBoundary({ error, params }: ErrorBoundaryProps<{ slug: string }>) {
 *   return (
 *     <div>
 *       <h1>Article Not Found</h1>
 *       <p>Could not load article: {params.slug}</p>
 *     </div>
 *   );
 * }
 * ```
 */
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
 *
 * @example Simple loader
 * ```tsx
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 *
 * export async function loader({ params }: RouteLoaderArgs) {
 *   const user = await getUser(params.id!);
 *   return { user };
 * }
 * ```
 *
 * @example Loader with deferred data
 * ```tsx
 * import { delay } from "@std/async/delay";
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 *
 * export function loader({ params }: RouteLoaderArgs) {
 *   return {
 *     user: getUser(params.id!),
 *     recommendations: delay(1000).then(() => getRecommendations(params.id!)),
 *   };
 * }
 * ```
 *
 * @example Loader that throws errors
 * ```tsx
 * import { HttpError } from "@udibo/http-error";
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 *
 * export async function loader({ params }: RouteLoaderArgs) {
 *   const post = await getPost(params.id!);
 *   if (!post) {
 *     throw new HttpError(404, "Post not found");
 *   }
 *   return { post };
 * }
 * ```
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
 *
 * @example Simple form action
 * ```tsx
 * import type { RouteActionArgs } from "@udibo/juniper";
 *
 * export async function action({ request }: RouteActionArgs) {
 *   const formData = await request.formData();
 *   const email = formData.get("email") as string;
 *   await subscribe(email);
 *   return { success: true };
 * }
 * ```
 *
 * @example Action with intent handling
 * ```tsx
 * import type { RouteActionArgs } from "@udibo/juniper";
 *
 * export async function action({ request, params }: RouteActionArgs) {
 *   const formData = await request.formData();
 *   const intent = formData.get("intent");
 *
 *   switch (intent) {
 *     case "update":
 *       const title = formData.get("title") as string;
 *       return { post: await updatePost(params.id!, { title }) };
 *     case "delete":
 *       await deletePost(params.id!);
 *       return { deleted: true };
 *     default:
 *       return { error: "Unknown intent" };
 *   }
 * }
 * ```
 *
 * @example Action with validation
 * ```tsx
 * import type { RouteActionArgs } from "@udibo/juniper";
 *
 * export async function action({ request }: RouteActionArgs) {
 *   const formData = await request.formData();
 *   const title = formData.get("title") as string;
 *
 *   if (!title || title.length < 3) {
 *     return { error: "Title must be at least 3 characters" };
 *   }
 *
 *   const post = await createPost({ title });
 *   return { post };
 * }
 * ```
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
 *
 * @example Complete route module
 * ```tsx
 * import type { ErrorBoundaryProps, RouteActionArgs, RouteLoaderArgs, RouteProps } from "@udibo/juniper";
 * import { Form } from "react-router";
 *
 * interface LoaderData {
 *   post: { id: string; title: string; content: string };
 * }
 *
 * interface ActionData {
 *   success?: boolean;
 *   error?: string;
 * }
 *
 * export async function loader({ params }: RouteLoaderArgs): Promise<LoaderData> {
 *   const post = await getPost(params.id!);
 *   return { post };
 * }
 *
 * export async function action({ request, params }: RouteActionArgs): Promise<ActionData> {
 *   const formData = await request.formData();
 *   const title = formData.get("title") as string;
 *   await updatePost(params.id!, { title });
 *   return { success: true };
 * }
 *
 * export default function PostPage({ loaderData, actionData }: RouteProps<{ id: string }, LoaderData, ActionData>) {
 *   return (
 *     <div>
 *       <h1>{loaderData.post.title}</h1>
 *       {actionData?.success && <p>Updated!</p>}
 *       <Form method="post">
 *         <input name="title" defaultValue={loaderData.post.title} />
 *         <button type="submit">Update</button>
 *       </Form>
 *     </div>
 *   );
 * }
 *
 * export function ErrorBoundary({ error }: ErrorBoundaryProps) {
 *   return <div>Error: {error instanceof Error ? error.message : "Unknown"}</div>;
 * }
 *
 * export function HydrateFallback() {
 *   return <div>Loading...</div>;
 * }
 * ```
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
 *
 * @example Root route module with error deserialization
 * ```tsx
 * import { Outlet } from "react-router";
 * import type { ErrorBoundaryProps } from "@udibo/juniper";
 * import { isSerializedError, type SerializedError } from "@udibo/juniper/client";
 *
 * export default function Root() {
 *   return (
 *     <>
 *       <meta charSet="utf-8" />
 *       <meta name="viewport" content="width=device-width,initial-scale=1.0" />
 *       <Outlet />
 *     </>
 *   );
 * }
 *
 * export function ErrorBoundary({ error, resetErrorBoundary }: ErrorBoundaryProps) {
 *   return (
 *     <div>
 *       <h1>Application Error</h1>
 *       <p>{error instanceof Error ? error.message : "Unknown error"}</p>
 *       <button onClick={resetErrorBoundary}>Try again</button>
 *     </div>
 *   );
 * }
 *
 * interface SerializedCustomError extends SerializedError {
 *   __subType: "CustomError";
 *   code: string;
 * }
 *
 * function isSerializedCustomError(value: unknown): value is SerializedCustomError {
 *   return isSerializedError(value) && value.__subType === "CustomError";
 * }
 *
 * export function deserializeError(serializedError: unknown) {
 *   if (isSerializedCustomError(serializedError)) {
 *     const error = new CustomError(serializedError.message, serializedError.code);
 *     error.stack = serializedError.stack;
 *     return error;
 *   }
 * }
 * ```
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
