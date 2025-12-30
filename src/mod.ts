import type { ReactElement } from "react";
import { RouterContextProvider } from "react-router";
import { HttpError } from "@udibo/http-error";

export { HttpError, RouterContextProvider };

export type AnyParams = Record<string, string | undefined>;

/**
 * The argument shape provided to route loaders.
 *
 * @template Params - The type of route params. Defaults to `AnyParams`.
 * @template LoaderData - The type of loader data. Defaults to `unknown`.
 *
 * @example Basic loader accessing params
 * ```tsx
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 *
 * interface LoaderData {
 *   post: Post;
 * }
 *
 * export async function loader({ params }: RouteLoaderArgs<{ id: string }, LoaderData>): Promise<LoaderData> {
 *   const post = await getPost(params.id);
 *   return { post };
 * }
 * ```
 *
 * @example Loader accessing request URL
 * ```tsx
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 *
 * interface LoaderData {
 *   results: SearchResult[];
 *   query: string;
 * }
 *
 * export async function loader({ request }: RouteLoaderArgs<AnyParams, LoaderData>): Promise<LoaderData> {
 *   const url = new URL(request.url);
 *   const query = url.searchParams.get("q") || "";
 *   const results = await search(query);
 *   return { results, query };
 * }
 * ```
 */
export interface RouteLoaderArgs<
  Params extends AnyParams = AnyParams,
  LoaderData = unknown,
> {
  context: RouterContextProvider;
  params: Params;
  request: Request;
  serverLoader: () => LoaderData | Response | Promise<LoaderData | Response>;
}

/**
 * The argument shape provided to route actions.
 *
 * @template Params - The type of route params. Defaults to `AnyParams`.
 * @template ActionData - The type of action data. Defaults to `unknown`.
 *
 * @example Action handling form submission
 * ```tsx
 * import type { RouteActionArgs } from "@udibo/juniper";
 *
 * interface ActionData {
 *   post: Post;
 * }
 *
 * export async function action({ request }: RouteActionArgs<AnyParams, ActionData>): Promise<ActionData> {
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
 * interface ActionData {
 *   deleted?: boolean;
 *   post?: Post;
 * }
 *
 * export async function action({ request, params }: RouteActionArgs<{ id: string }, ActionData>): Promise<ActionData> {
 *   const formData = await request.formData();
 *   const intent = formData.get("intent");
 *
 *   if (intent === "delete") {
 *     await deletePost(params.id);
 *     return { deleted: true };
 *   }
 *
 *   const title = formData.get("title") as string;
 *   const post = await updatePost(params.id, { title });
 *   return { post };
 * }
 * ```
 */
export interface RouteActionArgs<
  Params extends AnyParams = AnyParams,
  ActionData = unknown,
> {
  context: RouterContextProvider;
  params: Params;
  request: Request;
  serverAction: () => ActionData | Response | Promise<ActionData | Response>;
}

/**
 * The argument shape provided to route middleware.
 *
 * @template Params - The type of route params. Defaults to `AnyParams`.
 *
 * @example Middleware accessing context
 * ```tsx
 * import type { RouteMiddlewareArgs } from "@udibo/juniper";
 *
 * export const middleware = [
 *   async ({ context, request }: RouteMiddlewareArgs, next: () => Promise<void>) => {
 *     const session = await getSession(request);
 *     context.set(userContext, session.user);
 *     await next();
 *   },
 * ];
 * ```
 */
export interface RouteMiddlewareArgs<
  Params extends AnyParams = AnyParams,
> {
  context: RouterContextProvider;
  params: Params;
  request: Request;
}

/**
 * A middleware function exported by a route module.
 * Receives the same "data" arguments as a loader/action (request, params, context)
 * as the first parameter and a next function as the second parameter which will
 * call downstream handlers and then complete middlewares from the bottom-up.
 *
 * @template Params - The type of route params. Defaults to `AnyParams`.
 *
 * @example Authentication middleware
 * ```tsx
 * import { redirect } from "react-router";
 * import type { MiddlewareFunction } from "@udibo/juniper";
 *
 * const authMiddleware: MiddlewareFunction = async ({ context, request }, next) => {
 *   const session = await getSession(request);
 *   if (!session.userId) {
 *     throw redirect("/login");
 *   }
 *   const user = await getUserById(session.userId);
 *   context.set(userContext, user);
 *   await next();
 * };
 *
 * export const middleware = [authMiddleware];
 * ```
 *
 * @example Logging middleware
 * ```tsx
 * import type { MiddlewareFunction } from "@udibo/juniper";
 *
 * const loggingMiddleware: MiddlewareFunction = async ({ request }, next) => {
 *   console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
 *   const start = performance.now();
 *   await next();
 *   console.log(`[${new Date().toISOString()}] Completed in ${performance.now() - start}ms`);
 * };
 *
 * export const middleware = [loggingMiddleware];
 * ```
 */
export type MiddlewareFunction<
  Params extends AnyParams = AnyParams,
> = (
  args: RouteMiddlewareArgs<Params>,
  next: () => Promise<RouterContextProvider>,
) => Promise<void> | void;

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
 *
 * @example Route component accessing context
 * ```tsx
 * import type { RouteProps } from "@udibo/juniper";
 *
 * export default function Dashboard({ context }: RouteProps) {
 *   const user = context.get(userContext);
 *   return <div>Welcome, {user.name}</div>;
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
  /** The router context shared by middleware, loaders, actions, and components. */
  context: RouterContextProvider;
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
 * The props for HydrateFallback components.
 * Params are always available, but loaderData and actionData may not be loaded yet.
 */
export interface HydrateFallbackProps<
  Params extends AnyParams = AnyParams,
> {
  /** The params of the route. */
  params: Params;
  /** The router context shared by middleware, loaders, actions, and components. */
  context: RouterContextProvider;
}

/**
 * A React component type used for a route's HydrateFallback export.
 * This component is shown during hydration while the loader is pending.
 * It receives params but may not have loaderData or actionData yet.
 */
export type HydrateFallbackComponent<
  Params extends AnyParams = AnyParams,
> = BivariantComponent<HydrateFallbackProps<Params>>;

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
> = BivariantComponent<
  ErrorBoundaryProps<Params, LoaderData, ActionData>
>;

/**
 * A loader function exported by a route module.
 *
 * @template Params - The type of route params. Defaults to `AnyParams`.
 * @template LoaderData - The loader return value type. Defaults to `unknown`.
 *
 * @example Simple loader
 * ```tsx
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 *
 * interface LoaderData {
 *   user: User;
 * }
 *
 * export async function loader({ params }: RouteLoaderArgs<{ id: string }, LoaderData>): Promise<LoaderData> {
 *   const user = await getUser(params.id);
 *   return { user };
 * }
 * ```
 *
 * @example Loader with deferred data
 * ```tsx
 * import { delay } from "@std/async/delay";
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 *
 * interface LoaderData {
 *   user: Promise<User>;
 *   recommendations: Promise<Recommendation[]>;
 * }
 *
 * export function loader({ params }: RouteLoaderArgs<{ id: string }, LoaderData>): LoaderData {
 *   return {
 *     user: getUser(params.id),
 *     recommendations: delay(1000).then(() => getRecommendations(params.id)),
 *   };
 * }
 * ```
 *
 * @example Loader that throws errors
 * ```tsx
 * import { HttpError } from "@udibo/juniper";
 * import type { RouteLoaderArgs } from "@udibo/juniper";
 *
 * interface LoaderData {
 *   post: Post;
 * }
 *
 * export async function loader({ params }: RouteLoaderArgs<{ id: string }, LoaderData>): Promise<LoaderData> {
 *   const post = await getPost(params.id);
 *   if (!post) {
 *     throw new HttpError(404, "Post not found");
 *   }
 *   return { post };
 * }
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
 * An action function exported by a route module.
 *
 * @template Params - The type of route params. Defaults to `AnyParams`.
 * @template ActionData - The action return value type. Defaults to `unknown`.
 *
 * @example Simple form action
 * ```tsx
 * import type { AnyParams, RouteActionArgs } from "@udibo/juniper";
 *
 * interface ActionData {
 *   success: boolean;
 * }
 *
 * export async function action({ request }: RouteActionArgs<AnyParams, ActionData>): Promise<ActionData> {
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
 * interface ActionData {
 *   post?: Post;
 *   deleted?: boolean;
 *   error?: string;
 * }
 *
 * export async function action({ request, params }: RouteActionArgs<{ id: string }, ActionData>): Promise<ActionData> {
 *   const formData = await request.formData();
 *   const intent = formData.get("intent");
 *
 *   switch (intent) {
 *     case "update":
 *       const title = formData.get("title") as string;
 *       return { post: await updatePost(params.id, { title }) };
 *     case "delete":
 *       await deletePost(params.id);
 *       return { deleted: true };
 *     default:
 *       return { error: "Unknown intent" };
 *   }
 * }
 * ```
 *
 * @example Action with validation
 * ```tsx
 * import type { AnyParams, RouteActionArgs } from "@udibo/juniper";
 *
 * interface ActionData {
 *   post?: Post;
 *   error?: string;
 * }
 *
 * export async function action({ request }: RouteActionArgs<AnyParams, ActionData>): Promise<ActionData> {
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
  Params extends AnyParams = AnyParams,
  ActionData = unknown,
> = {
  bivarianceHack(
    args: RouteActionArgs<Params, ActionData>,
  ): ActionData | Promise<ActionData>;
}["bivarianceHack"];

/**
 * The contract for a route module file.
 *
 * @template Params - The type of route params.
 * @template LoaderData - The loader return value type.
 * @template ActionData - The action return value type.
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
 * export async function loader({ params }: RouteLoaderArgs<{ id: string }, LoaderData>): Promise<LoaderData> {
 *   const post = await getPost(params.id);
 *   return { post };
 * }
 *
 * export async function action({ request, params }: RouteActionArgs<{ id: string }, ActionData>): Promise<ActionData> {
 *   const formData = await request.formData();
 *   const title = formData.get("title") as string;
 *   await updatePost(params.id, { title });
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
> {
  /** The route's component. */
  default?: RouteComponent<Params, LoaderData, ActionData>;
  /** The route's error boundary component. */
  ErrorBoundary?: RouteErrorBoundary<Params, LoaderData, ActionData>;
  /** The route's hydration fallback component shown during hydration before loader completes. */
  HydrateFallback?: HydrateFallbackComponent<Params>;
  /** The loader function. */
  loader?: LoaderFunction<Params, LoaderData>;
  /** The action function. */
  action?: ActionFunction<Params, ActionData>;
  /** The middleware functions that run before loaders and actions. */
  middleware?: MiddlewareFunction<Params>[];
}

/**
 * The contract for the root route module.
 *
 * @template Params - The type of route params.
 * @template LoaderData - The loader return value type.
 * @template ActionData - The action return value type.
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
  SerializedContext = unknown,
> extends RouteModule<Params, LoaderData, ActionData> {
  /**
   * Extends the default error deserialization used on the client when rehydrating errors
   * thrown by loaders or actions on the server.
   */
  deserializeError?: (serializedError: unknown) => unknown;
  /**
   * Deserializes the context from the server during client-side hydration.
   * This allows server-side context values to be transferred to the client.
   *
   * @param serializedContext - The serialized context from the server's serializeContext function.
   * @returns A RouterContextProvider populated with the deserialized context values.
   */
  deserializeContext?(
    serializedContext?: SerializedContext,
  ): RouterContextProvider;
}
