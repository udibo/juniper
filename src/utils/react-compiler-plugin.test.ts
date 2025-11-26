import { delay } from "@std/async/delay";
import { assertEquals, assertStringIncludes } from "@std/assert";
import * as path from "@std/path";
import { afterAll, describe, it } from "@std/testing/bdd";
import * as esbuild from "esbuild";

import { reactCompilerPlugin } from "./react-compiler-plugin.ts";

describe("reactCompilerPlugin", () => {
  afterAll(async () => {
    await esbuild.stop();
    await delay(10);
  });

  describe("basic functionality", () => {
    it("should process .tsx files and apply React Compiler", async () => {
      const tmp = await Deno.makeTempDir();
      const testComponentPath = path.resolve(tmp, "TestComponent.tsx");

      const testComponent = `export default function TestComponent() {
  const [count, setCount] = React.useState(0);
  return <div>{count}</div>;
}`;

      await Deno.writeTextFile(testComponentPath, testComponent);

      try {
        const context = await esbuild.context({
          entryPoints: [testComponentPath],
          bundle: false,
          write: false,
          format: "esm",
          plugins: [
            reactCompilerPlugin({
              sourceMaps: false,
            }),
          ],
          jsx: "automatic",
          jsxImportSource: "react",
        });

        try {
          const result = await context.rebuild();
          const output = result.outputFiles[0];
          const outputText = new TextDecoder().decode(output.contents);

          assertStringIncludes(
            outputText,
            "react/compiler-runtime",
            "Should import React Compiler runtime",
          );
          assertStringIncludes(
            outputText,
            "_c(",
            "Should contain compiler runtime calls",
          );
        } finally {
          await context.dispose();
        }
      } finally {
        await Deno.remove(tmp, { recursive: true });
      }
    });

    it("should not process .ts files", async () => {
      const tmp = await Deno.makeTempDir();
      const testFilePath = path.resolve(tmp, "test.ts");

      const testFile = `export function test() {
  return "test";
}`;

      await Deno.writeTextFile(testFilePath, testFile);

      try {
        const context = await esbuild.context({
          entryPoints: [testFilePath],
          bundle: false,
          write: false,
          format: "esm",
          plugins: [
            reactCompilerPlugin(),
          ],
        });

        try {
          const result = await context.rebuild();
          const output = result.outputFiles[0];
          const outputText = new TextDecoder().decode(output.contents);

          assertEquals(
            outputText.includes("react/compiler-runtime"),
            false,
            "Should not contain React Compiler runtime for .ts files",
          );
        } finally {
          await context.dispose();
        }
      } finally {
        await Deno.remove(tmp, { recursive: true });
      }
    });

    it("should accept custom runtime module path option", async () => {
      const tmp = await Deno.makeTempDir();
      const testComponentPath = path.resolve(tmp, "TestComponent.tsx");

      const testComponent = `export default function TestComponent() {
  const [count, setCount] = React.useState(0);
  const doubled = count * 2;
  return <div>{doubled}</div>;
}`;

      await Deno.writeTextFile(testComponentPath, testComponent);

      try {
        const context = await esbuild.context({
          entryPoints: [testComponentPath],
          bundle: false,
          write: false,
          format: "esm",
          plugins: [
            reactCompilerPlugin({
              runtimeModulePath: "custom/react-runtime",
            }),
          ],
          jsx: "automatic",
          jsxImportSource: "react",
        });

        try {
          const result = await context.rebuild();
          const output = result.outputFiles[0];
          const outputText = new TextDecoder().decode(output.contents);

          assertStringIncludes(
            outputText,
            "react/compiler-runtime",
            "Should process component with React Compiler",
          );
          assertEquals(result.errors.length, 0, "Build should succeed");
        } finally {
          await context.dispose();
        }
      } finally {
        await Deno.remove(tmp, { recursive: true });
      }
    });

    it("should cache transformed files", async () => {
      const tmp = await Deno.makeTempDir();
      const testComponentPath = path.resolve(tmp, "TestComponent.tsx");

      const testComponent = `export default function TestComponent() {
  return <div>Test</div>;
}`;

      await Deno.writeTextFile(testComponentPath, testComponent);

      try {
        const plugin = reactCompilerPlugin();

        const context = await esbuild.context({
          entryPoints: [testComponentPath],
          bundle: false,
          write: false,
          format: "esm",
          plugins: [plugin],
          jsx: "automatic",
          jsxImportSource: "react",
        });

        try {
          const firstResult = await context.rebuild();
          const firstOutput = new TextDecoder().decode(
            firstResult.outputFiles[0].contents,
          );

          const secondResult = await context.rebuild();
          const secondOutput = new TextDecoder().decode(
            secondResult.outputFiles[0].contents,
          );

          assertEquals(
            firstOutput,
            secondOutput,
            "Cached output should match first build",
          );
        } finally {
          await context.dispose();
        }
      } finally {
        await Deno.remove(tmp, { recursive: true });
      }
    });

    it("should handle components with hooks", async () => {
      const tmp = await Deno.makeTempDir();
      const testComponentPath = path.resolve(tmp, "TestComponent.tsx");

      const testComponent = `import { useState } from "react";

export default function TestComponent() {
  const [count, setCount] = useState(0);
  const doubled = count * 2;
  
  return (
    <div>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
      <p>Doubled: {doubled}</p>
    </div>
  );
}`;

      await Deno.writeTextFile(testComponentPath, testComponent);

      try {
        const context = await esbuild.context({
          entryPoints: [testComponentPath],
          bundle: false,
          write: false,
          format: "esm",
          plugins: [
            reactCompilerPlugin({
              sourceMaps: false,
            }),
          ],
          jsx: "automatic",
          jsxImportSource: "react",
        });

        try {
          const result = await context.rebuild();
          const output = result.outputFiles[0];
          const outputText = new TextDecoder().decode(output.contents);

          assertStringIncludes(
            outputText,
            "react/compiler-runtime",
            "Should import React Compiler runtime",
          );
          assertStringIncludes(
            outputText,
            "useState",
            "Should preserve React hooks",
          );
        } finally {
          await context.dispose();
        }
      } finally {
        await Deno.remove(tmp, { recursive: true });
      }
    });

    it("should handle custom filter regex", async () => {
      const tmp = await Deno.makeTempDir();
      const testComponentPath = path.resolve(tmp, "TestComponent.tsx");
      const testJsPath = path.resolve(tmp, "test.jsx");

      const testComponent = `export default function TestComponent() {
  const [count, setCount] = React.useState(0);
  return <div>{count}</div>;
}`;

      await Deno.writeTextFile(testComponentPath, testComponent);
      await Deno.writeTextFile(testJsPath, testComponent);

      try {
        const tsxContext = await esbuild.context({
          entryPoints: [testComponentPath],
          bundle: false,
          write: false,
          format: "esm",
          plugins: [
            reactCompilerPlugin({
              filter: /\.(tsx|jsx)$/,
            }),
          ],
          jsx: "automatic",
          jsxImportSource: "react",
        });

        try {
          const tsxResult = await tsxContext.rebuild();
          const tsxOutput = new TextDecoder().decode(
            tsxResult.outputFiles[0].contents,
          );

          const jsxContext = await esbuild.context({
            entryPoints: [testJsPath],
            bundle: false,
            write: false,
            format: "esm",
            plugins: [
              reactCompilerPlugin({
                filter: /\.(tsx|jsx)$/,
              }),
            ],
            jsx: "automatic",
            jsxImportSource: "react",
          });

          try {
            const jsxResult = await jsxContext.rebuild();
            const jsxOutput = new TextDecoder().decode(
              jsxResult.outputFiles[0].contents,
            );

            assertStringIncludes(
              tsxOutput,
              "react/compiler-runtime",
              "Should process .tsx files",
            );
            assertStringIncludes(
              jsxOutput,
              "react/compiler-runtime",
              "Should process .jsx files with custom filter",
            );
          } finally {
            await jsxContext.dispose();
          }
        } finally {
          await tsxContext.dispose();
        }
      } finally {
        await Deno.remove(tmp, { recursive: true });
      }
    });
  });
});
