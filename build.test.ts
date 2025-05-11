import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import * as path from "@std/path";

import { isSnapshotMode } from "./utils/testing.ts";
import { buildMainFile } from "./build.ts";

const exampleDir = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "example",
);

describe("buildMainFile", () => {
  it("should generate content structurally similar to example/main.ts", async () => {
    const generatedContent = await buildMainFile(exampleDir);

    const exampleMainTsPath = path.join(exampleDir, "main.ts");
    if (isSnapshotMode()) {
      await Deno.writeTextFile(exampleMainTsPath, generatedContent);
    } else {
      const expectedContent = await Deno.readTextFile(exampleMainTsPath);

      assertEquals(
        generatedContent,
        expectedContent,
        "Generated content should match example/main.ts. If this fails due to the auto-generation comment, ensure example/main.ts also includes it or adjust buildMainFile.",
      );
    }
  });
});
