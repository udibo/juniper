import {
  denoLoaderPlugin,
  denoResolverPlugin,
} from "@luca/esbuild-deno-loader";
import { delay } from "@std/async/delay";
import { sortBy } from "@std/collections/sort-by";
import { ensureDir, exists, walk } from "@std/fs";
import * as path from "@std/path";
import { toText } from "@std/streams";
import * as esbuild from "esbuild";

import { isProduction } from "@udibo/juniper/utils/env";

import { deno } from "./deno.ts";
import { startActiveSpan } from "./utils/_otel.ts";

interface GeneratedRoute {
  path: string;
  main?: string;
  index?: string;
  catchall?: string;
  children?: GeneratedRoute[];
}

interface DirRouteProperties {
  main?: string;
  index?: string;
  catchall?: string;
  fileModuleChildren: GeneratedRoute[];
  parameterizedChildren: GeneratedRoute[];
  directoryChildren: GeneratedRoute[];
}

function isMainRoute(fileName: string): boolean {
  return fileName === "main.ts";
}

function isIndexRoute(fileName: string): boolean {
  return fileName === "index.ts";
}

function isCatchallRoute(fileName: string): boolean {
  return fileName === "[...].ts";
}

function isDynamicRoute(fileName: string): boolean {
  return fileName.startsWith("[") && fileName.endsWith("].ts") &&
    !isCatchallRoute(fileName);
}

function getDynamicRouteParam(fileName: string): string {
  return fileName.slice(1, -4);
}

function isDynamicDirName(dirName: string): boolean {
  return dirName.startsWith("[") && dirName.endsWith("]");
}

function getDynamicDirParam(dirName: string): string {
  return dirName.slice(1, -1);
}

function isRegularFileModule(fileName: string): boolean {
  return fileName.endsWith(".ts") &&
    !isMainRoute(fileName) &&
    !isIndexRoute(fileName) &&
    !isCatchallRoute(fileName) &&
    !isDynamicRoute(fileName) &&
    !fileName.startsWith("_") &&
    !fileName.includes(".test");
}

function isClientMainRoute(fileName: string): boolean {
  return fileName === "main.tsx";
}

function isClientIndexRoute(fileName: string): boolean {
  return fileName === "index.tsx";
}

function isClientCatchallRoute(fileName: string): boolean {
  return fileName === "[...].tsx";
}

function isClientDynamicRoute(fileName: string): boolean {
  return fileName.startsWith("[") && fileName.endsWith("].tsx") &&
    !isClientCatchallRoute(fileName);
}

function getClientDynamicRouteParam(fileName: string): string {
  return fileName.slice(1, -5);
}

function isRegularClientFileModule(fileName: string): boolean {
  return fileName.endsWith(".tsx") &&
    !isClientMainRoute(fileName) &&
    !isClientIndexRoute(fileName) &&
    !isClientCatchallRoute(fileName) &&
    !isClientDynamicRoute(fileName) &&
    !fileName.startsWith("_") &&
    !fileName.includes(".test");
}

async function processDirectory(
  absoluteDirPath: string,
  importPathBase: string,
): Promise<DirRouteProperties> {
  const properties: DirRouteProperties = {
    fileModuleChildren: [],
    parameterizedChildren: [],
    directoryChildren: [],
  };

  let dirEntries = [];
  let firstEntrySkipped = false;
  for await (
    const entry of walk(absoluteDirPath, {
      maxDepth: 1,
      includeDirs: true,
      includeFiles: true,
      followSymlinks: false,
    })
  ) {
    if (!firstEntrySkipped) {
      firstEntrySkipped = true;
      continue;
    }
    dirEntries.push(entry);
  }

  const entryPriority = (name: string): number => {
    if (isMainRoute(name)) return 0;
    if (isIndexRoute(name)) return 1;
    if (isCatchallRoute(name)) return 2;
    if (isDynamicRoute(name)) return 3;
    return 4;
  };

  dirEntries = sortBy(
    dirEntries,
    (e) => `${e.isFile ? "0" : "1"}-${entryPriority(e.name)}-${e.name}`,
  );

  for (const entry of dirEntries) {
    const currentFileImportPath = `${importPathBase}/${entry.name}`;
    const moduleImport = `await import("${currentFileImportPath}")`;

    if (entry.isFile && entry.name.endsWith(".ts")) {
      if (isMainRoute(entry.name)) {
        properties.main = moduleImport;
      } else if (isIndexRoute(entry.name)) {
        properties.index = moduleImport;
      } else if (isCatchallRoute(entry.name)) {
        properties.catchall = moduleImport;
      } else if (isDynamicRoute(entry.name)) {
        const paramName = getDynamicRouteParam(entry.name);
        properties.parameterizedChildren.push({
          path: `:${paramName}`,
          main: moduleImport,
        });
      } else if (isRegularFileModule(entry.name)) {
        const routeName = entry.name.slice(0, -3);
        properties.fileModuleChildren.push({
          path: routeName,
          main: moduleImport,
        });
      }
    } else if (entry.isDirectory) {
      // Skip conventionally private directories like _components, _utils, etc.
      if (entry.name.startsWith("_")) continue;

      const subDirAbsolutePath = path.join(absoluteDirPath, entry.name);
      const subDirImportPathBase = `${importPathBase}/${entry.name}`;
      const subDirProps = await processDirectory(
        subDirAbsolutePath,
        subDirImportPathBase,
      );

      const children = [
        ...subDirProps.fileModuleChildren,
        ...subDirProps.directoryChildren,
        ...subDirProps.parameterizedChildren,
      ];

      let routePathSegment = entry.name;
      const isDynamicDir = isDynamicDirName(entry.name);
      if (isDynamicDir) {
        routePathSegment = `:${getDynamicDirParam(entry.name)}`;
      }

      const dirRoute: GeneratedRoute = {
        path: routePathSegment,
      };
      if (subDirProps.main) dirRoute.main = subDirProps.main;
      if (subDirProps.index) dirRoute.index = subDirProps.index;
      if (subDirProps.catchall) dirRoute.catchall = subDirProps.catchall;
      if (children.length > 0) dirRoute.children = children;

      if (isDynamicDir) {
        properties.parameterizedChildren.push(dirRoute);
      } else {
        properties.directoryChildren.push(dirRoute);
      }
    }
  }
  return properties;
}

/**
 * Processes a directory for client routes (.tsx files).
 * Similar to processDirectory but generates lazy loading syntax for client routes.
 */
async function processClientDirectory(
  absoluteDirPath: string,
  importPathBase: string,
  isRootLevel: boolean,
): Promise<DirRouteProperties> {
  const properties: DirRouteProperties = {
    fileModuleChildren: [],
    parameterizedChildren: [],
    directoryChildren: [],
  };

  let dirEntries = [];
  let firstEntrySkipped = false;
  for await (
    const entry of walk(absoluteDirPath, {
      maxDepth: 1,
      includeDirs: true,
      includeFiles: true,
      followSymlinks: false,
    })
  ) {
    if (!firstEntrySkipped) {
      firstEntrySkipped = true;
      continue;
    }
    dirEntries.push(entry);
  }

  const entryPriority = (name: string): number => {
    if (isClientMainRoute(name)) return 0;
    if (isClientIndexRoute(name)) return 1;
    if (isClientCatchallRoute(name)) return 2;
    if (isClientDynamicRoute(name)) return 3;
    return 4;
  };

  dirEntries = sortBy(
    dirEntries,
    (e) => `${e.isFile ? "0" : "1"}-${entryPriority(e.name)}-${e.name}`,
  );

  for (const entry of dirEntries) {
    const currentFileImportPath = `${importPathBase}/${entry.name}`;
    const lazyImport = `() => import("${currentFileImportPath}")`;
    const directImport = `await import("${currentFileImportPath}")`;

    if (entry.isFile && entry.name.endsWith(".tsx")) {
      if (isClientMainRoute(entry.name)) {
        // Only root-level main routes use await import, nested main routes use lazy import
        properties.main = isRootLevel ? directImport : lazyImport;
      } else if (isClientIndexRoute(entry.name)) {
        properties.index = lazyImport; // Index routes use lazy import
      } else if (isClientCatchallRoute(entry.name)) {
        properties.catchall = lazyImport; // Catchall routes use lazy import
      } else if (isClientDynamicRoute(entry.name)) {
        const paramName = getClientDynamicRouteParam(entry.name);
        properties.parameterizedChildren.push({
          path: `:${paramName}`,
          main: lazyImport, // Dynamic routes use lazy import
        });
      } else if (isRegularClientFileModule(entry.name)) {
        const routeName = entry.name.slice(0, -4); // Remove .tsx
        properties.fileModuleChildren.push({
          path: routeName,
          main: lazyImport, // Regular file modules use lazy import
        });
      }
    } else if (entry.isDirectory) {
      // Skip conventionally private directories like _components, _utils, etc.
      if (entry.name.startsWith("_")) continue;

      const subDirAbsolutePath = path.join(absoluteDirPath, entry.name);
      const subDirImportPathBase = `${importPathBase}/${entry.name}`;
      const subDirProps = await processClientDirectory(
        subDirAbsolutePath,
        subDirImportPathBase,
        false,
      );

      const children = [
        ...subDirProps.fileModuleChildren,
        ...subDirProps.directoryChildren,
        ...subDirProps.parameterizedChildren,
      ];

      // Only include directories that have .tsx files (main, index, catchall, or children)
      const hasClientRoutes = subDirProps.main || subDirProps.index ||
        subDirProps.catchall || children.length > 0;
      if (!hasClientRoutes) continue;

      let routePathSegment = entry.name;
      const isDynamicDir = isDynamicDirName(entry.name);
      if (isDynamicDir) {
        routePathSegment = `:${getDynamicDirParam(entry.name)}`;
      }

      const dirRoute: GeneratedRoute = {
        path: routePathSegment,
      };
      if (subDirProps.main) dirRoute.main = subDirProps.main;
      if (subDirProps.index) dirRoute.index = subDirProps.index;
      if (subDirProps.catchall) dirRoute.catchall = subDirProps.catchall;
      if (children.length > 0) dirRoute.children = children;

      if (isDynamicDir) {
        properties.parameterizedChildren.push(dirRoute);
      } else {
        properties.directoryChildren.push(dirRoute);
      }
    }
  }
  return properties;
}

/**
 * Converts a generated route object to a string.
 *
 * @param obj The generated route object to convert to a string.
 * @param indentLevel The level of indentation to use when converting the object to a string.
 * @returns The generated route object as a string.
 */
function generatedRouteObjectToString(
  obj: GeneratedRoute | string | GeneratedRoute[],
  indentLevel: number = 0,
): string {
  const indent = "  ".repeat(indentLevel);
  const nextIndent = "  ".repeat(indentLevel + 1);

  if (typeof obj === "string") {
    if (obj.startsWith("await import(") || obj.startsWith("() => import(")) {
      return obj;
    }
    return `"${
      obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")
    }"`;
  }
  if (Array.isArray(obj)) {
    const arrElements = obj.map((item) =>
      generatedRouteObjectToString(item, indentLevel + 1)
    ).join(`,\n${nextIndent}`);
    return `[\n${nextIndent}${arrElements}\n${indent}]`;
  }
  if (typeof obj === "object" && obj !== null) {
    const props = Object.entries(obj)
      .filter(([, value]) => {
        return value !== undefined;
      })
      .map(([key, value]) =>
        `${nextIndent}${key}: ${
          generatedRouteObjectToString(value, indentLevel + 1)
        }`
      )
      .join(",\n");

    return `{\n${props}\n${indent}}`;
  }
  // Fallback for type checking, should be unreachable with correct input types
  throw new Error(
    `Unhandled type in generatedRouteObjectToString: ${typeof obj}`,
  );
}

const fmtCommand = new Deno.Command(Deno.execPath(), {
  args: ["fmt", "-"],
  stdin: "piped",
  stdout: "piped",
});

/**
 * Configuration options for building the application.
 */
export interface BuildOptions {
  /**
   * The absolute path to the project's root directory.
   * All other paths will be resolved relative to this directory.
   *
   * Defaults to the current working directory.
   */
  projectRoot?: string;

  /**
   * Path to your deno.json or deno.jsonc configuration file.
   * Defaults to searching for these files in the project's root directory.
   */
  configPath?: string;

  /**
   * Additional esbuild plugins to use when building your application.
   * These plugins will be inserted after the deno resolver but before the deno loader plugin.
   */
  plugins?: esbuild.Plugin[];

  /**
   * Additional entry points to build beyond the main application entry point.
   * This is useful for building stylesheets, worker scripts, or other assets.
   *
   * Examples:
   * - Single CSS file: ["./styles/main.css"]
   * - All CSS files in routes: ["./routes/**\/*.css"]
   * - Multiple entry points: ["./styles/main.css", "./workers/sw.ts"]
   *
   * Built files will be placed in the public/build directory.
   * Defaults to an empty array.
   */
  entryPoints?: string[];
  /**
   * The paths to watch for changes when using the dev server.
   *
   * Defaults to the project root.
   */
  watchPaths?: string | string[];
  /**
   * Whether to write the esbuild results to the public directory's build subdirectory.
   * This is used for testing purposes.
   *
   * Defaults to true.
   */
  write?: boolean;
}

/**
 * A set of active builders.
 *
 * This is used to track the active builders and to stop esbuild when all builders are disposed.
 */
const activeBuilders = new Set<Builder>();

/**
 * A builder for a Juniper application.
 *
 * This class is used to build a Juniper application with custom build options.
 * It is responsible for generating the main server file and building the application.
 * It also provides a way for the dev server to rebuild the application.
 *
 * @example Building an application
 * ```ts
 * import { Builder } from "@udibo/juniper/build";
 * import * as path from "@std/path";
 *
 * const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
 * export const builder = new Builder({ projectRoot });
 *
 * if (import.meta.main) {
 *   await builder.build();
 *   await builder.dispose();
 * }
 * ```
 */
export class Builder implements AsyncDisposable {
  readonly projectRoot: string;
  readonly routesPath: string;
  readonly publicPath: string;
  readonly configPath: string;
  readonly serverPath: string;
  readonly clientPath: string;
  readonly entryPoint: string;
  readonly watchPaths: string | string[];
  readonly outdir: string;
  readonly entryPoints: string[];
  protected write: boolean;
  protected plugins: esbuild.Plugin[];
  protected context?: esbuild.BuildContext;
  protected _isBuilding: boolean;

  get isBuilding(): boolean {
    return this._isBuilding;
  }

  /**
   * Creates a new builder for a Juniper application.
   *
   * @param options - The options for the builder.
   */
  constructor(options: BuildOptions = {}) {
    this.projectRoot = options.projectRoot ?? Deno.cwd();
    this.watchPaths = options.watchPaths ?? this.projectRoot;
    this.routesPath = path.resolve(this.projectRoot, "./routes");
    this.publicPath = path.resolve(this.projectRoot, "./public");
    this.configPath = path.resolve(
      this.projectRoot,
      options.configPath ?? "./deno.json",
    );
    this.entryPoint = path.resolve(this.projectRoot, "./main.tsx");
    this.entryPoints = [...(options.entryPoints ?? []), this.entryPoint];
    this.plugins = [...(options.plugins ?? [])];
    this.outdir = path.resolve(this.publicPath, "build");
    this.serverPath = path.resolve(this.projectRoot, "./main.ts");
    this.clientPath = path.resolve(this.projectRoot, "./main.tsx");
    this._isBuilding = false;
    this.write = options.write ?? true;
  }

  /**
   * Disposes the esbuild context and marks the builder as inactive.
   * This can either be called manually or automatically using explicit resource management.
   * If this is called for the last active builder, it will also stop esbuild.
   *
   * @returns A promise that resolves when the builder is disposed.
   */
  async dispose(): Promise<void> {
    const context = this.context;
    if (context) {
      await context.dispose();
      activeBuilders.delete(this);
    }
    if (activeBuilders.size === 0) {
      await esbuild.stop();
      // Wait for esbuild to stop completely
      await delay(10);
    }
  }
  [Symbol.asyncDispose](): Promise<void> {
    return this.dispose();
  }

  /**
   * Generates the main server file by scanning the routes directory and creating
   * the appropriate route configuration. This function is used internally by the build script.
   *
   * This function walks through the routes directory, discovers all route files following
   * Juniper's file-based routing conventions, and generates a main.ts file that imports
   * and configures all routes using the createServer function.
   *
   * @example Generating main.ts file
   * ```ts
   * import { Builder } from "@udibo/juniper/build";
   *
   * const projectRoot = new URL(".", import.meta.url).pathname;
   * const builder = new Builder({ projectRoot });
   * const mainFileContent = await builder.buildMainFile(projectRoot);
   *
   * await Deno.writeTextFile("main.ts", mainFileContent);
   * console.log("Generated main.ts");
   * ```
   *
   * @returns A promise that resolves to a boolean indicating whether the build was successful or not.
   */
  buildMainServerEntrypoint(): Promise<void> {
    return startActiveSpan("buildMainServerEntrypoint", async () => {
      const routesDirScanningRoot = this.routesPath;
      const importPrefixForRoutes = "./" +
        path.relative(this.projectRoot, this.routesPath);

      const rootDirProperties = await processDirectory(
        routesDirScanningRoot,
        importPrefixForRoutes,
      );

      const allRootChildren = [
        ...rootDirProperties.fileModuleChildren,
        ...rootDirProperties.parameterizedChildren,
        ...rootDirProperties.directoryChildren,
      ].sort((a, b) => a.path.localeCompare(b.path));

      const finalRoutesConfig: GeneratedRoute = {
        path: "/",
      };
      if (rootDirProperties.main) {
        finalRoutesConfig.main = rootDirProperties.main;
      }
      if (rootDirProperties.index) {
        finalRoutesConfig.index = rootDirProperties.index;
      }
      if (rootDirProperties.catchall) {
        finalRoutesConfig.catchall = rootDirProperties.catchall;
      }
      if (allRootChildren.length > 0) {
        finalRoutesConfig.children = allRootChildren;
      }

      const routesConfigString = generatedRouteObjectToString(
        finalRoutesConfig,
        1,
      );

      const fmt = fmtCommand.spawn();
      const fmtWriter = fmt.stdin.getWriter();
      const encoder = new TextEncoder();
      fmtWriter.write(encoder.encode(`\
// This file is auto-generated by @udibo/juniper/build
// Do not edit this file directly.

import { createServer } from "@udibo/juniper/server";

import { client } from "./main.tsx";

export const server = createServer(import.meta.url, client, ${routesConfigString});

if (import.meta.main) {
  Deno.serve(server.fetch);
}
`));
      fmtWriter.close();
      const { success, code } = await fmt.status;
      if (!success) {
        throw new Error(`Failed to format generated main server file: ${code}`);
      }

      const contents = await toText(fmt.stdout);
      await deno.writeTextFile(this.serverPath, contents);
    });
  }

  /**
   * Generates the main client file by scanning the routes directory for .tsx files
   * and creating the appropriate client route configuration with lazy loading.
   *
   * This function walks through the routes directory, discovers all .tsx route files
   * following Juniper's file-based routing conventions, and generates a main.tsx file
   * that imports and configures all client routes using the createClient function.
   *
   * @returns A promise that resolves when the client entry point is built.
   */
  buildMainClientEntrypoint(): Promise<void> {
    return startActiveSpan("buildMainClientEntrypoint", async () => {
      const routesDirScanningRoot = this.routesPath;
      const importPrefixForRoutes = "./" +
        path.relative(this.projectRoot, this.routesPath);

      const rootDirProperties = await processClientDirectory(
        routesDirScanningRoot,
        importPrefixForRoutes,
        true,
      );

      const allRootChildren = [
        ...rootDirProperties.fileModuleChildren,
        ...rootDirProperties.parameterizedChildren,
        ...rootDirProperties.directoryChildren,
      ].sort((a, b) => a.path.localeCompare(b.path));

      const finalRoutesConfig: GeneratedRoute = {
        path: "/",
      };
      if (rootDirProperties.main) {
        finalRoutesConfig.main = rootDirProperties.main;
      }
      if (rootDirProperties.index) {
        finalRoutesConfig.index = rootDirProperties.index;
      }
      if (rootDirProperties.catchall) {
        finalRoutesConfig.catchall = rootDirProperties.catchall;
      }
      if (allRootChildren.length > 0) {
        finalRoutesConfig.children = allRootChildren;
      }

      const routesConfigString = generatedRouteObjectToString(
        finalRoutesConfig,
        1,
      );

      const fmt = fmtCommand.spawn();
      const fmtWriter = fmt.stdin.getWriter();
      const encoder = new TextEncoder();
      fmtWriter.write(encoder.encode(`\
// This file is auto-generated by @udibo/juniper/build
// Do not edit this file directly.

import { Client } from "@udibo/juniper/client";
import { isBrowser } from "@udibo/juniper/utils/env";

export const client = new Client(${routesConfigString});

if (isBrowser()) {
  await client.hydrate();
}
`));
      fmtWriter.close();
      const { success, code } = await fmt.status;
      if (!success) {
        throw new Error(`Failed to format generated main client file: ${code}`);
      }

      const contents = await toText(fmt.stdout);
      await deno.writeTextFile(this.clientPath, contents);
    });
  }

  /**
   * Generates the build for a Juniper application.
   *
   * This function creates an esbuild context for the build and then triggers a build for the application.
   * If you want to trigger a rebuild after the initial build, you can use the rebuild function.
   *
   * @returns A promise that resolves to the build results.
   */
  build(): Promise<esbuild.BuildResult<esbuild.BuildOptions>> {
    return startActiveSpan("build", async () => {
      if (this.isBuilding || this.context) {
        throw new Error("Build already started, use rebuild instead");
      }
      console.log("🔨 Building app...");
      this._isBuilding = true;
      const startTime = performance.now();
      let success = false;
      try {
        let configPath = this.configPath;
        if (!await exists(configPath)) {
          configPath = path.resolve(configPath, "deno.jsonc");
          if (!await exists(configPath)) {
            throw new Error("Could not find deno config file");
          }
        }
        await ensureDir(this.outdir);

        const buildOptions: esbuild.BuildOptions = isProduction()
          ? { minify: true }
          : {
            minifyIdentifiers: false,
            minifySyntax: true,
            minifyWhitespace: true,
            jsxDev: true,
            sourcemap: "linked",
          };
        buildOptions.write = this.write;

        if (this.write) {
          await this.buildMainServerEntrypoint();
          await this.buildMainClientEntrypoint();
        }

        const normalizedEntryPoints =
          Deno.build.os === "windows"
            ? this.entryPoints.map((p) => p.replace(/\\/g, "/"))
            : this.entryPoints;

        this.context = await esbuild.context({
          plugins: [
            // deno-lint-ignore no-explicit-any
            denoResolverPlugin({ configPath }) as any,
            ...this.plugins,
            // deno-lint-ignore no-explicit-any
            denoLoaderPlugin({ configPath }) as any,
          ],
          absWorkingDir: path.dirname(configPath),
          entryPoints: normalizedEntryPoints,
          outdir: this.outdir,
          outbase: this.projectRoot,
          bundle: true,
          splitting: true,
          treeShaking: true,
          platform: "browser",
          format: "esm",
          jsx: "automatic",
          jsxImportSource: "react",
          ...buildOptions,
        });
        activeBuilders.add(this);
        const results = await this.context.rebuild();
        success = true;
        return results;
      } finally {
        const duration = Math.round(performance.now() - startTime);
        if (success) {
          const status = success ? "completed" : "failed";
          const symbol = success ? "✅" : "❌";
          console.log(`${symbol} Build ${status} in ${duration}ms`);
        }
        this._isBuilding = false;
      }
    });
  }

  rebuild(options: {
    server?: boolean;
    client?: boolean;
  }): Promise<esbuild.BuildResult<esbuild.BuildOptions>> {
    return startActiveSpan("rebuild", async () => {
      if (!this.context) {
        throw new Error("Build already started, use rebuild instead");
      }
      if (this.isBuilding) {
        throw new Error("Build already in progress");
      }
      console.log("🔨 Rebuilding app...");
      this._isBuilding = true;
      const startTime = performance.now();
      let success = false;
      try {
        if (this.write) {
          if (options.server) {
            await this.buildMainServerEntrypoint();
          }
          if (options.client) {
            await this.buildMainClientEntrypoint();
          }
        }
        const results = await this.context.rebuild();
        success = true;
        return results;
      } finally {
        const duration = Math.round(performance.now() - startTime);
        if (success) {
          const status = success ? "completed" : "failed";
          const symbol = success ? "✅" : "❌";
          console.log(`${symbol} Rebuild ${status} in ${duration}ms`);
        }
        this._isBuilding = false;
      }
    });
  }
}

if (import.meta.main) {
  await using builder = new Builder({ projectRoot: Deno.cwd() });
  await builder.build();
}
