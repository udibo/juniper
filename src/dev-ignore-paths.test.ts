import { assert, assertEquals } from "@std/assert";
import * as path from "@std/path";
import { describe, it } from "@std/testing/bdd";

import { Builder } from "./build.ts";

import { DevServer } from "./_dev.ts";

async function withIgnoredPaths(
  directory: string,
  fn: (builder: Builder, server: DevServer) => Promise<void> | void,
): Promise<void> {
  const projectRoot = await Deno.makeTempDir({ prefix: "juniper ignore " });
  try {
    for (
      const file of [
        "data/item.ts",
        "data/deep/item.tsx",
        "data-next/page.tsx",
        "database/file.ts",
        "data.ts",
        "settings.json",
        "settings.json.backup",
        "settings.json-next/page.tsx",
        "routes/index.tsx",
      ]
    ) {
      const absolutePath = path.join(projectRoot, file);
      await Deno.mkdir(path.dirname(absolutePath), { recursive: true });
      await Deno.writeTextFile(absolutePath, "");
    }
    await using builder = new Builder({
      projectRoot,
      ignorePaths: [directory, "./settings.json"],
      write: false,
    });
    const watched = await builder.resolveWatchPaths();
    assertEquals(
      watched.sort(),
      [
        "data-next",
        "database",
        "data.ts",
        "settings.json.backup",
        "settings.json-next",
        "routes",
      ].map((relativePath) => path.join(projectRoot, relativePath)).sort(),
    );
    await fn(builder, new DevServer({ builder }));
  } finally {
    await Deno.remove(projectRoot, { recursive: true });
  }
}

describe("configured dev ignore path boundaries", () => {
  for (const directory of ["./data", "./data/"]) {
    for (
      const sibling of [
        "data-next/page.tsx",
        "database/file.ts",
        "data.ts",
        "settings.json.backup",
        "settings.json-next/page.tsx",
      ]
    ) {
      it(`rebuilds watched ${sibling} with ignored ${directory}`, async () => {
        await withIgnoredPaths(directory, (builder, server) => {
          assert(
            server.shouldTriggerRebuild(
              path.join(builder.projectRoot, sibling),
              sibling,
            ),
            `a watched prefix sibling must trigger rebuilding: ${sibling}`,
          );
        });
      });
    }

    it(`normalizes backslashes without ignoring data-next for ${directory}`, async () => {
      await withIgnoredPaths(directory, (builder, server) => {
        const relativePath = "data-next/page.tsx";
        assert(
          server.shouldTriggerRebuild(
            path.join(builder.projectRoot, relativePath).replaceAll("/", "\\"),
            relativePath.replaceAll("/", "\\"),
          ),
        );
        assertEquals(
          server.shouldTriggerRebuild(
            path.join(builder.projectRoot, "data/item.ts").replaceAll(
              "/",
              "\\",
            ),
            "data\\item.ts",
          ),
          false,
        );
      });
    });

    it(`ignores exact configured paths and descendants for ${directory}`, async () => {
      await withIgnoredPaths(directory, (builder, server) => {
        for (
          const relativePath of [
            "data",
            "data/item.ts",
            "data/deep/item.tsx",
            "settings.json",
            "settings.json/child.ts",
          ]
        ) {
          assertEquals(
            server.shouldTriggerRebuild(
              path.join(builder.projectRoot, relativePath),
              relativePath,
            ),
            false,
            relativePath,
          );
        }
      });
    });

    it(`retains default exclusions and ordinary helper rebuilds for ${directory}`, async () => {
      await withIgnoredPaths(directory, (builder, server) => {
        for (
          const relativePath of [
            "app.log",
            "temp.tmp",
            "file.lock",
            "somefile~",
            "build.ts",
            "dev.ts",
            "public/build/app.js",
            "routes/page.test.tsx",
          ]
        ) {
          assertEquals(
            server.shouldTriggerRebuild(
              path.join(builder.projectRoot, relativePath),
              relativePath,
            ),
            false,
            relativePath,
          );
        }
        for (
          const relativePath of [
            "routes/index.tsx",
            "routes/page.ts",
            "routes/_components/helper.tsx",
            "components/Button.tsx",
          ]
        ) {
          assert(
            server.shouldTriggerRebuild(
              path.join(builder.projectRoot, relativePath),
              relativePath,
            ),
            relativePath,
          );
        }
      });
    });

    it(`retains case-sensitive path comparison for ${directory}`, async () => {
      await withIgnoredPaths(directory, (builder, server) => {
        assert(
          server.shouldTriggerRebuild(
            path.join(builder.projectRoot, "Data/item.ts"),
            "Data/item.ts",
          ),
        );
      });
    });
  }
});
