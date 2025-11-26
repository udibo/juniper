import { denoPlugin } from "@deno/esbuild-plugin";
import { delay } from "@std/async/delay";
import { ensureDir, exists } from "@std/fs";
import * as path from "@std/path";
import { toText } from "@std/streams";
import * as esbuild from "esbuild";

import { isProduction } from "@udibo/juniper/utils/env";

import {
  type GeneratedRoute,
  generatedRouteObjectToString,
  processClientDirectory,
  processDirectory,
} from "./_build.ts";
import { deno } from "./deno.ts";
import { reactCompilerPlugin } from "./utils/react-compiler-plugin.ts";
import { startActiveSpan } from "./utils/_otel.ts";

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
      const importPrefixForRoutes = ("./" +
        path.relative(this.projectRoot, this.routesPath)).replace(/\\/g, "/");

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
      const importPrefixForRoutes = ("./" +
        path.relative(this.projectRoot, this.routesPath)).replace(/\\/g, "/");

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

export const client = new Client(${routesConfigString});
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

        const normalizedEntryPoints = Deno.build.os === "windows"
          ? this.entryPoints.map((p) => path.toFileUrl(p).href)
          : this.entryPoints;

        this.context = await esbuild.context({
          plugins: [
            denoPlugin({ configPath }),
            reactCompilerPlugin({
              sourceMaps: buildOptions.sourcemap !== false,
            }),
            ...this.plugins,
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
