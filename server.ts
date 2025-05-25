import { Hono } from "hono";
import type { Env, Schema } from "hono";
import { createMiddleware } from "hono/factory";
import { serveStatic } from "hono/deno";
import { trimTrailingSlash } from "hono/trailing-slash";
import * as path from "@std/path";
import { HttpError } from "@udibo/http-error";
import { getInstance } from "@udibo/juniper/utils/otel";

const notFound = createMiddleware(() => {
  throw new HttpError(404, "Not found");
});

export interface Routes<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
> {
  path: BasePath;
  main?: { default?: Hono<E, S, BasePath> };
  index?: { default?: Hono<E, S, BasePath> };
  catchall?: { default?: Hono<E, S, BasePath> };
  children?: Routes<E, S, BasePath>[];
}

function buildAppFromRoutes<
  E extends Env,
  S extends Schema,
  BasePath extends string,
>(
  mainUrl: string,
  routeConfig: Routes<E, S, BasePath>,
  root: boolean = false,
): Hono<E, S, BasePath> {
  const { main, index, catchall, children } = routeConfig;
  const app = main?.default ?? new Hono<E, S, BasePath>();

  if (children) {
    for (const childRoute of children) {
      const childApp = buildAppFromRoutes(mainUrl, childRoute);
      app.route(
        childRoute.path,
        childApp,
      );
    }
  }

  if (index?.default) {
    app.route("/", index.default);
  }

  if (catchall?.default) {
    app.route(
      "/:*{.+}",
      catchall.default,
    );
    app.route(
      "*",
      catchall.default,
    );
  }

  if (root) {
    const dirname = path.dirname(path.fromFileUrl(mainUrl));
    const absolutePublicPath = path.resolve(dirname, "./public");

    // Workaround for Hono Windows issue: use simple relative path from cwd
    const cwd = Deno.cwd();
    const relativePath = path.relative(cwd, absolutePublicPath);

    // Ensure forward slashes on Windows for Hono compatibility
    const publicPath = Deno.build.os === "windows"
      ? relativePath.replace(/\\/g, "/")
      : relativePath;

    // Note: There's a known issue with Hono's serveStatic on Windows (https://github.com/honojs/hono/issues/3475)
    // This workaround attempts to work around path separator and relative path issues
    app.get(
      "*",
      serveStatic({
        root: publicPath,
      }),
    );
  }
  app.use("*", notFound);

  return app;
}

export function createApp<
  E extends Env = Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(
  mainUrl: string,
  routes: Routes<E, S, BasePath>,
): Hono<E, S, BasePath> {
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

  const app = buildAppFromRoutes(mainUrl, routes, true);

  appWrapper.route("/", app);
  return appWrapper;
}
