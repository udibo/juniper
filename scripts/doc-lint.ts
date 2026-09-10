/**
 * Checks every published entrypoint for undocumented API and optionally checks
 * its JSDoc examples. Known external-type diagnostics are scoped to their file,
 * public symbol, and referenced type; the named private Builder methods are
 * exempt only while their source declarations remain private.
 * @module
 */
import { fromFileUrl, relative, resolve, toFileUrl } from "@std/path";

const externalReferences = new Map<string, ReadonlySet<string>>([
  ["mod.ts", new Set(['ContextSerializer["context"]|RouterContext'])],
  [
    "build.ts",
    new Set([
      'BuildOptions["plugins"]|Plugin',
      "Builder.prototype.plugins|Plugin",
      "Builder.prototype.context|BuildContext",
      "Builder.prototype.build|BuildResult",
      "Builder.prototype.build|BuildOptions",
    ]),
  ],
  [
    "_server.tsx",
    new Set([
      "AppEnv|Env",
      "Route|Schema",
      'ServerRouteModule["default"]|Hono',
    ]),
  ],
  ["server.tsx", new Set(["createServer|Schema", "createServer|Hono"])],
  ["client.tsx", new Set(["Client.prototype.routeObjects|RouteObject"])],
  [
    "utils/otel.ts",
    new Set([
      'OtelUtils["startActiveSpan"]|Span',
      'OtelUtils["startActiveSpan"]|SpanOptions',
      'OtelUtils["startActiveSpan"]|Context',
      "otelUtils|Tracer",
    ]),
  ],
  [
    "utils/testing.ts",
    new Set([
      'RoutesStubProps["hydrationData"]|HydrationState',
      "createRoutesStub|React",
      "createRoutesStub|React.ComponentType",
      "waitForFakeTime|waitFor",
    ]),
  ],
]);

const routerReferences = new Set([
  "RouterContextProvider.prototype.get|RouterContext",
  "redirect|RedirectFunction",
  "redirectDocument|RedirectFunction",
]);

function splitDiagnostics(
  stderr: string,
): { blocks: string[]; fatal: string[]; counts: number[] } {
  const blocks: string[] = [];
  const fatal: string[] = [];
  const counts: number[] = [];
  let current: string[] = [];
  function finish(): void {
    if (current.length) blocks.push(current.join("\n").trim());
    current = [];
  }
  for (const line of stderr.split(/\r?\n/)) {
    if (line.startsWith("error[")) {
      finish();
      current.push(line);
    } else if (line.startsWith("error:")) {
      finish();
      const summary = line.match(
        /^error: Found (\d+) documentation lint errors?\.$/,
      );
      if (summary) counts.push(Number(summary[1]));
      else fatal.push(line);
    } else if (current.length) {
      current.push(line);
    }
  }
  finish();
  return { blocks, fatal, counts };
}

async function isTolerated(block: string, sourceDir: string): Promise<boolean> {
  const location = block.match(/^\s*-->\s+(.+):(\d+):(\d+)\s*$/m);
  if (!location) return false;
  const file = location[1].startsWith("file:")
    ? fromFileUrl(location[1])
    : resolve(sourceDir, location[1]);
  const localFile = relative(sourceDir, file).replaceAll("\\", "/");
  const typeRef = block.match(
    /^error\[private-type-ref\]: public type '([^']+)' references private type '([^']+)'(?:\r?\n|$)/,
  );
  if (typeRef) {
    const reference = `${typeRef[1]}|${typeRef[2]}`;
    if (externalReferences.get(localFile)?.has(reference)) return true;
    return /\/node_modules\/react-router\/dist\/(?:production|development)\/lib\/router\/utils\.d\.ts$/
      .test(file.replaceAll("\\", "/")) &&
      routerReferences.has(reference);
  }
  if (!block.startsWith("error[missing-jsdoc]:") || localFile !== "build.ts") {
    return false;
  }
  const sourceLine =
    (await Deno.readTextFile(file)).split(/\r?\n/)[Number(location[2]) - 1];
  return /^\s*private\s+(?:async\s+)?(?:collectWatchPaths|isPathIgnored)\s*\(/
    .test(sourceLine ?? "");
}

/** Classifies one doc invocation; only the named package/type exceptions can pass a lint failure. */
export async function assessDocLint(
  code: number,
  stderr: string,
  sourceDir: string,
): Promise<{ passed: boolean; violations: string[] }> {
  const { blocks, fatal, counts } = splitDiagnostics(stderr);
  const violations = [...fatal];
  for (const block of blocks) {
    if (!await isTolerated(block, sourceDir)) violations.push(block);
  }
  if (
    code !== 0 &&
    (code !== 1 || blocks.length === 0 || counts.length !== 1 ||
      counts[0] !== blocks.length)
  ) {
    violations.push(
      "deno doc failed without a matching documentation diagnostic summary.",
    );
  }
  return { passed: violations.length === 0, violations };
}

/** Checks the export map at configUrl; examples mode also runs its test task with --doc --no-run. */
export async function lintDocumentation(
  configUrl: URL,
  examples = false,
): Promise<boolean> {
  const sourceDir = fromFileUrl(new URL(".", configUrl));
  const config = JSON.parse(await Deno.readTextFile(configUrl));
  if (
    !config.exports || typeof config.exports !== "object" ||
    Array.isArray(config.exports)
  ) {
    throw new Error("The package configuration must contain an exports map.");
  }
  const entrypoints: unknown[] = Object.values(config.exports);
  if (
    entrypoints.length === 0 ||
    entrypoints.some((entry) => typeof entry !== "string" || entry.length === 0)
  ) {
    throw new Error("Every export must name a nonempty entrypoint path.");
  }
  const result = await new Deno.Command(Deno.execPath(), {
    args: ["doc", "--lint", ...entrypoints as string[]],
    cwd: sourceDir,
    env: { NO_COLOR: "1" },
    stdout: "null",
    stderr: "piped",
  }).output();
  const stderr = new TextDecoder().decode(result.stderr);
  const assessment = await assessDocLint(result.code, stderr, sourceDir);
  if (!assessment.passed) {
    console.error(stderr);
    console.error(
      `doc-lint: ${assessment.violations.length} unexplained documentation failure(s).`,
    );
    return false;
  }
  if (examples) {
    const exampleCheck = await new Deno.Command(Deno.execPath(), {
      args: ["task", "test", "--doc", "--no-run", ...entrypoints as string[]],
      cwd: sourceDir,
      env: { NO_COLOR: "1" },
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!exampleCheck.success) {
      console.error(new TextDecoder().decode(exampleCheck.stdout));
      console.error(new TextDecoder().decode(exampleCheck.stderr));
      console.error("doc-lint: JSDoc examples failed to type-check.");
      return false;
    }
  }
  console.log(
    `doc-lint: ${entrypoints.length} entrypoints${
      examples ? " and their JSDoc examples" : ""
    } clean.`,
  );
  return true;
}

if (import.meta.main) {
  try {
    const args = Deno.args.filter((argument) => argument !== "--examples");
    if (args.length > 1 || args[0]?.startsWith("--")) {
      throw new Error("Usage: doc-lint.ts [--examples] [src/deno.json]");
    }
    const configUrl = args[0]
      ? toFileUrl(resolve(args[0]))
      : new URL("../src/deno.json", import.meta.url);
    Deno.exit(
      await lintDocumentation(configUrl, Deno.args.includes("--examples"))
        ? 0
        : 1,
    );
  } catch (error) {
    console.error(error);
    Deno.exit(1);
  }
}
