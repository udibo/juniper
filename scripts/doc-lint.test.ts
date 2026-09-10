import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { fromFileUrl, join } from "@std/path";

import { assessDocLint } from "./doc-lint.ts";

async function fixture(
  exports: Record<string, string>,
  files: Record<string, string>,
) {
  const directory = await Deno.makeTempDir({
    prefix: "juniper-doc-lint-test-",
  });
  const config = join(directory, "deno.json");
  await Deno.writeTextFile(
    config,
    JSON.stringify({ exports, tasks: { test: "deno test" } }),
  );
  for (const [name, source] of Object.entries(files)) {
    await Deno.writeTextFile(join(directory, name), source);
  }
  return {
    directory,
    config,
    async [Symbol.asyncDispose]() {
      await Deno.remove(directory, { recursive: true });
    },
  };
}

async function runGate(config: string, examples = false) {
  return await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--config",
      fromFileUrl(new URL("../deno.json", import.meta.url)),
      "--allow-read",
      "--allow-run",
      new URL("doc-lint.ts", import.meta.url).href,
      ...(examples ? ["--examples"] : []),
      config,
    ],
    env: { NO_COLOR: "1" },
    stdout: "piped",
    stderr: "piped",
  }).output();
}

describe("public documentation gate", () => {
  it("checks all exports and rejects removing JSDoc from an additional entrypoint", async () => {
    const documented =
      "/**\n * Fixture API.\n * @module\n */\n/** Returns a fixture value. */\nexport function value(): number { return 1; }\n";
    await using project = await fixture({
      ".": "./mod.ts",
      "./extra": "./extra.ts",
    }, {
      "mod.ts": documented,
      "extra.ts": documented,
    });
    assertEquals((await runGate(project.config)).success, true);
    await Deno.writeTextFile(
      join(project.directory, "extra.ts"),
      "export function value(): number { return 1; }\n",
    );
    const result = await runGate(project.config);
    assertEquals(result.success, false);
    assertStringIncludes(
      new TextDecoder().decode(result.stderr),
      "error[missing-jsdoc]",
    );
  });

  it("fails when an exported entrypoint does not exist", async () => {
    await using project = await fixture({ ".": "./missing.ts" }, {});
    const result = await runGate(project.config);
    assertEquals(result.success, false);
    assertStringIncludes(
      new TextDecoder().decode(result.stderr),
      "Module not found",
    );
  });

  it("type-checks JSDoc examples without running them", async () => {
    await using project = await fixture({ ".": "./mod.ts" }, {
      "mod.ts":
        "/**\n * Fixture API.\n * @example\n * ```ts\n * throw new Error('Do not run documentation examples');\n * ```\n */\nexport function value(): number { return 1; }\n",
    });
    assertEquals((await runGate(project.config, true)).success, true);
    await Deno.writeTextFile(
      join(project.directory, "mod.ts"),
      "/**\n * Fixture API.\n * @example\n * ```ts\n * const value: number = 'wrong';\n * ```\n */\nexport function value(): number { return 1; }\n",
    );
    const result = await runGate(project.config, true);
    assertEquals(result.success, false);
    assertStringIncludes(
      new TextDecoder().decode(result.stderr),
      "JSDoc examples failed to type-check",
    );
  });

  it("tolerates the named private Builder methods but rejects making one public without JSDoc", async () => {
    await using project = await fixture({ ".": "./build.ts" }, {
      "build.ts":
        "/** Fixture API. @module */\n/** Builds the fixture. */\nexport class Builder {\n private collectWatchPaths(): void {}\n}\n",
    });
    assertEquals((await runGate(project.config)).success, true);
    await Deno.writeTextFile(
      join(project.directory, "build.ts"),
      "/** Fixture API. @module */\n/** Builds the fixture. */\nexport class Builder {\n collectWatchPaths(): void {}\n}\n",
    );
    assertEquals((await runGate(project.config)).success, false);
  });

  it("does not hide a plain fatal error beside an allowed external reference", async () => {
    await using project = await fixture({ ".": "./mod.ts" }, {});
    const diagnostic =
      `error[private-type-ref]: public type 'AppEnv' references private type 'Env'\n --> ${
        join(project.directory, "_server.tsx")
      }:1:1\n`;
    const summary = "error: Found 1 documentation lint error.\n";
    assertEquals(
      (await assessDocLint(1, diagnostic + summary, project.directory)).passed,
      true,
    );
    for (
      const suffix of [
        "error: Module not found\n",
        "error[unexpected]: Unknown lint error\n",
      ]
    ) {
      assertEquals(
        (await assessDocLint(
          1,
          diagnostic + summary + suffix,
          project.directory,
        )).passed,
        false,
      );
    }
    assertEquals(
      (await assessDocLint(1, diagnostic, project.directory)).passed,
      false,
    );
    assertEquals(
      (await assessDocLint(2, diagnostic + summary, project.directory)).passed,
      false,
    );
  });

  it("rejects an external-reference diagnostic for an unlisted symbol or file", async () => {
    await using project = await fixture({ ".": "./mod.ts" }, {});
    for (
      const [symbol, file] of [["OtherEnv", "_server.tsx"], [
        "AppEnv",
        "other.ts",
      ]]
    ) {
      const diagnostic =
        `error[private-type-ref]: public type '${symbol}' references private type 'Env'\n --> ${
          join(project.directory, file)
        }:1:1\nerror: Found 1 documentation lint error.\n`;
      assertEquals(
        (await assessDocLint(1, diagnostic, project.directory)).passed,
        false,
      );
    }
  });
});
