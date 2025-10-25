/**
 * This module is used for creating the server side entrypoint for Juniper applications.
 * This is for internal use only. It is used in the generated `main.ts` file.
 *
 * @module
 */
import { Hono } from "hono";
import type { Env, Schema } from "hono";
import { createFactory, createMiddleware } from "hono/factory";
import { stream } from "hono/streaming";
import { serveStatic } from "hono/deno";
import { trimTrailingSlash } from "hono/trailing-slash";
import * as path from "@std/path";
import { HttpError } from "@udibo/http-error";
import { getInstance } from "@udibo/juniper/utils/otel";
import { isDevelopment } from "@udibo/juniper/utils/env";
import {
  createStaticHandler,
  createStaticRouter,
  RouterContextProvider,
  StaticRouterProvider,
} from "react-router";
import type { RouteObject } from "react-router";
import { StrictMode } from "react";
import { renderToReadableStream } from "react-dom/server";
import reactHelmetAsync from "react-helmet-async";
const { HelmetProvider } = reactHelmetAsync;
import type { HelmetServerState } from "react-helmet-async";
import serialize from "serialize-javascript";

import type {
  Client,
  ClientRoute,
  HydrationData,
  SerializedError,
} from "./client.tsx";
import { serializeErrorDefault, serializeRouteData } from "./_server.tsx";
import type { Route } from "./_server.tsx";

const notFound = createMiddleware(() => {
  throw new HttpError(404, "Not found");
});

/**
 * Creates handlers for React Router.
 *
 * This function is used to create handlers for React Router.
 *
 * @param routes - The routes to create handlers for
 * @returns The handlers for the routes
 */
function createHandlers<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(route: Route<E, S, BasePath>, routes: RouteObject[]) {
  const factory = createFactory();
  const serializeError = route.main?.serializeError ?? (() => {});
  const { query, dataRoutes, queryRoute } = createStaticHandler(routes);

  return factory.createHandlers(
    async function handleDocumentRequest(c, next) {
      if (c.req.header("accept")?.includes("application/json")) {
        return next();
      }

      // TODO: Change where this is created so that it can be used by server middleware.
      const requestContext = new RouterContextProvider();
      const contextOrResponse = await query(c.req.raw, {
        requestContext,
      });

      if (contextOrResponse instanceof Response) {
        return contextOrResponse;
      }
      const context = contextOrResponse;

      const router = createStaticRouter(dataRoutes, context);

      const helmetContext = { helmet: {} as HelmetServerState };
      let renderStream: ReturnType<typeof renderToReadableStream>;
      async function render() {
        try {
          renderStream = await renderToReadableStream(
            <StrictMode>
              {/* @ts-ignore */}
              <HelmetProvider context={helmetContext}>
                <StaticRouterProvider router={router} context={context} />
              </HelmetProvider>
            </StrictMode>,
            {
              onCaughtError: (error: unknown, errorInfo: unknown) => {
                console.log("render onCaughtError", error, errorInfo);
              },
              onUnhandledRejection: (error: unknown) => {
                console.log("render onUnhandledRejection", error);
              },
              onError: (error: unknown) => {
                console.log("render onError", error);
              },
            },
          );
          await renderStream.allReady;
        } catch (error) {
          if (!context.errors) context.errors = {};
          if (
            context._deepestRenderedBoundaryId &&
            !(context._deepestRenderedBoundaryId in context.errors)
          ) {
            context.errors[context._deepestRenderedBoundaryId] = error;
            await render();
          } else {
            throw error;
          }
        }
      }
      await render();

      console.log("context", context);
      const hydrationData: HydrationData = {
        matches: context.matches.map((match) => ({
          id: match.route.id,
        })),
        errors: context.errors && Object.entries(context.errors)
          .reduce((acc, [id, error]) => {
            acc[id] = serializeError(error) ?? serializeErrorDefault(error);
            return acc;
          }, {} as Record<string, SerializedError | unknown>),
        loaderData: context.loaderData &&
          await serializeRouteData(route, context.loaderData),
        actionData: context.actionData &&
          await serializeRouteData(route, context.actionData),
      };

      const deepestMatch = context.matches[context.matches.length - 1];
      const actionHeaders = context.actionHeaders[deepestMatch.route.id];
      const loaderHeaders = context.loaderHeaders[deepestMatch.route.id];

      for (const [key, value] of actionHeaders?.entries() ?? []) {
        c.header(key, value);
      }
      for (const [key, value] of loaderHeaders?.entries() ?? []) {
        c.header(key, value);
      }

      c.header("Content-Type", "text/html; charset=utf-8");
      return stream(c, async (stream) => {
        await stream.writeln("<!DOCTYPE html>");
        const { helmet } = helmetContext;
        await stream.writeln(`<html ${helmet.htmlAttributes.toString()}>`);
        await stream.writeln("  <head>");
        const headTags = [
          helmet.base.toString(),
          helmet.title.toString(),
          helmet.priority.toString(),
          helmet.meta.toString(),
          helmet.link.toString(),
          helmet.style.toString(),
          helmet.script.toString(),
          helmet.noscript.toString(),
        ].filter((tag) => Boolean(tag));
        for (const tag of headTags) {
          await stream.writeln(`    ${tag}`);
        }
        await stream.writeln(
          `    <script>window.__juniperHydrationData = ${
            serialize(hydrationData, { isJSON: true })
          }</script>`,
        );
        await stream.writeln(
          `    <script type="module" src="/build/main.js"></script>`,
        );
        if (isDevelopment()) {
          await stream.writeln(
            `    <script src="/dev-client.js" defer></script>`,
          );
        }
        await stream.writeln("  </head>");
        await stream.writeln(`  <body ${helmet.bodyAttributes.toString()}>`);
        await stream.write(`    <div id="root">`);
        await stream.pipe(renderStream);
        await stream.writeln("</div>");
        await stream.writeln("  </body>");
        await stream.writeln("</html>");
      });
    },
    async function handleDataRequest(c) {
      const data = await queryRoute(c.req.raw);
      return c.json(data);
    },
  );
}

/**
 * Builds a Hono application by combining client and server routes.
 *
 * The logic is:
 * - If only server routes exist: use them as-is
 * - If only client routes exist: add React handlers for document requests
 * - If both exist: server routes run first (middleware), then client handlers for document requests
 *
 * @param serverRoutes - The server route configuration
 * @param clientRoutes - The client route configuration
 * @param reactHandlers - The React Router handlers for rendering pages
 * @param projectRoot - Optional project root for static file serving
 * @returns A configured Hono application
 */
function buildApp<
  E extends Env,
  S extends Schema,
  BasePath extends string,
>(
  serverRoute: Route<E, S, BasePath>,
  clientRoute: ClientRoute,
  reactHandlers: ReturnType<typeof createHandlers>,
  projectRoot?: string,
): Hono<E, S, BasePath> {
  // Start with server's main app or create new one
  const app = serverRoute.main?.default ?? new Hono<E, S, BasePath>();

  // Add React handlers for main route if client route exists
  if (!clientRoute.index && clientRoute.main) {
    app.get("/", ...reactHandlers);
    app.post("/", ...reactHandlers);
  }

  // Handle index routes
  if (clientRoute.index || serverRoute.index) {
    const indexApp = serverRoute.index?.default ?? new Hono<E, S, BasePath>();
    if (clientRoute.index) {
      indexApp.get("/", ...reactHandlers);
      indexApp.post("/", ...reactHandlers);
    }
    app.route("/", indexApp);
  }

  // Handle children routes
  const allChildPaths = new Set([
    ...(serverRoute.children || []).map((r) => r.path),
    ...(clientRoute.children || []).map((r) => r.path),
  ]);

  for (const childPath of allChildPaths) {
    const serverChild = serverRoute.children?.find((r) => r.path === childPath);
    const clientChild = clientRoute.children?.find((r) => r.path === childPath);

    if (serverChild || clientChild) {
      const childApp = buildApp(
        serverChild || { path: childPath as BasePath },
        clientChild || { path: childPath },
        reactHandlers,
      );
      app.route(`/${childPath}`, childApp);
    }
  }

  // Add static file serving if this is the root
  if (projectRoot) {
    // Workaround for Hono Windows issue: use simple relative path from cwd
    const cwd = Deno.cwd();
    let publicPath = path.resolve(projectRoot, "./public");
    const relativePath = path.relative(cwd, publicPath);

    // Ensure forward slashes on Windows for Hono compatibility
    publicPath = Deno.build.os === "windows"
      ? relativePath.replace(/\\/g, "/")
      : relativePath;

    // Serve dev client script in development mode
    if (isDevelopment()) {
      const devClientPath = path.fromFileUrl(
        import.meta.resolve("./dev-client.js"),
      );
      const devClientContent = Deno.readTextFileSync(devClientPath);
      app.get("/dev-client.js", (c) => {
        return c.body(devClientContent, 200, {
          "Content-Type": "application/javascript",
        });
      });
    }

    // Note: There's a known issue with Hono's serveStatic on Windows (https://github.com/honojs/hono/issues/3475)
    // This workaround attempts to work around path separator and relative path issues
    app.get(
      "*",
      serveStatic({
        root: publicPath,
      }),
    );
  }

  // Handle catchall routes
  if (clientRoute.catchall || serverRoute.catchall) {
    const catchallApp = serverRoute.catchall?.default ??
      new Hono<E, S, BasePath>();
    if (clientRoute.catchall) {
      catchallApp.get("/", ...reactHandlers);
      catchallApp.post("/", ...reactHandlers);
    }
    app.route("/:*{.+}", catchallApp);
    app.route("*", catchallApp);
  }

  app.use("*", notFound);
  return app;
}

/**
 * Creates a Hono application server with the provided route configuration.
 * The main entrypoint that uses this function is automatically generated by the build script.
 *
 * This function sets up error handling, trailing slash trimming, static file serving,
 * and builds the complete route tree from the provided configuration, merging both
 * client and server routes.
 *
 * @example Creating an application
 * ```ts
 * import { createServer } from "@udibo/juniper/server";
 *
 * export const server = createServer(import.meta.url, client, {
 *   path: "/",
 *   main: await import("./routes/main.ts"),
 *   children: [
 *     {
 *       path: "/api",
 *       main: await import("./routes/api/main.ts"),
 *       children: [
 *         {
 *           path: "/users",
 *           main: await import("./routes/api/users.ts"),
 *         }
 *       ]
 *     }
 *   ]
 * });
 *
 * if (import.meta.main) {
 *   Deno.serve(server.fetch);
 * }
 * ```
 *
 * @template E - Hono environment type
 * @template S - Hono schema type
 * @template BasePath - Base path string type
 *
 * @param moduleUrl - The URL of the module creating the server
 * @param client - The client configuration
 * @param routes - The server route configuration object
 * @returns A configured Hono application instance
 */
export function createServer<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(
  moduleUrl: string,
  client: Client,
  route: Route<E, S, BasePath>,
): Hono<E, S, BasePath> {
  const projectRoot = path.dirname(path.fromFileUrl(moduleUrl));
  const appWrapper = new Hono<E, S, BasePath>({ strict: true });

  appWrapper.onError((cause) => {
    const error = HttpError.from(cause);
    if (!error.instance) {
      const instance = getInstance();
      if (instance) {
        error.instance = instance;
      }
    }
    console.error(error);
    return error.getResponse();
  });
  appWrapper.use(trimTrailingSlash());

  // TODO: Override client routes actions and loaders with server routes actions and loaders
  // Initially manually override the client routes actions and loaders with server routes actions and loaders.
  // Then after learning how they work automate it.
  // client routes use lazy, need to unlazy them to replace the actions and loaders
  // By unlazy, I mean the server will await the lazy function, replacing it on the route with it's contents.
  // But the loader and action will be replaced with the server routes actions and loaders.
  const clientRoutes = client.routeObjects;
  const handlers = createHandlers(route, clientRoutes);
  const app = buildApp(route, client.rootRoute, handlers, projectRoot);

  appWrapper.route("/", app);
  return appWrapper;
}
