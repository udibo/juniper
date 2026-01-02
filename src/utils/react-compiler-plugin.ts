/**
 * React Compiler plugin for esbuild.
 *
 * This implementation is based on the ReactCompilerEsbuildPlugin from:
 * https://gist.github.com/sikanhe/f9ac68dd4c78c914c29cc98e7b875466
 *
 * Adapted for Deno and this project's needs.
 */

import * as babel from "@babel/core";
import BabelPluginReactCompiler from "babel-plugin-react-compiler";
import * as esbuild from "esbuild";
import type { Plugin } from "esbuild";
import QuickLRU from "quick-lru";

export interface ReactCompilerPluginOptions {
  filter?: RegExp;
  sourceMaps?: boolean;
  runtimeModulePath?: string;
}

export function reactCompilerPlugin(
  options: ReactCompilerPluginOptions = {},
): Plugin {
  const filter = options.filter ?? /\.tsx$/;
  const sourceMaps = options.sourceMaps ?? false;
  const runtimeModulePath = options.runtimeModulePath ??
    "react/compiler-runtime";

  return {
    name: "react-compiler",
    setup(build) {
      const buildCache = new QuickLRU<string, string>({ maxSize: 1000 });
      const timings: number[] = [];

      build.onEnd(() => {
        if (timings.length > 0) {
          const totalTime = timings.reduce((sum, x) => sum + x, 0).toFixed(0);
          console.log(`[⚛️ React Compiler] ${timings.length} files processed`);
          console.log(`[⚛️ React Compiler] Used ${totalTime} ms`);
          timings.length = 0;
        }
      });

      build.onLoad({ filter, namespace: "" }, async (args) => {
        // Skip remote URLs (JSR/npm packages) - they don't need React Compiler processing
        const isRemote = args.path.startsWith("http://") ||
          args.path.startsWith("https://");
        if (isRemote) {
          return undefined;
        }

        const contents = await Deno.readTextFile(args.path);

        const t0 = performance.now();

        if (buildCache.has(contents)) {
          return {
            contents: buildCache.get(contents)!,
            loader: "js",
          };
        }

        const output = await esbuild.transform(contents, {
          loader: "tsx",
          jsx: "automatic",
          define: build.initialOptions.define,
          target: build.initialOptions.target,
        });

        const transformResult = babel.transformSync(output.code, {
          plugins: [
            [
              BabelPluginReactCompiler,
              {
                runtimeModule: runtimeModulePath,
              },
            ],
          ],
          filename: args.path,
          caller: {
            name: "esbuild-react-compiler-plugin",
            supportsStaticESM: true,
          },
          sourceMaps,
        });

        timings.push(performance.now() - t0);

        if (transformResult?.code) {
          buildCache.set(contents, transformResult.code);
        }

        return {
          contents: transformResult?.code ?? undefined,
          loader: "js",
        };
      });
    },
  };
}
