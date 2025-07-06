import { describe, it } from "@std/testing/bdd";
import { assertSpyCall, assertSpyCalls, spy, stub } from "@std/testing/mock";
import { assertEquals, assertRejects } from "@std/assert";
import * as path from "@std/path";

import { isSnapshotMode } from "./utils/testing.ts";
import { Builder } from "./build.ts";
import { deno } from "./deno.ts";

const exampleDir = path.resolve(
  path.dirname(path.fromFileUrl(import.meta.url)),
  "example",
);

describe("Builder", () => {
  describe("buildMainServerEntrypoint", () => {
    it("should generate content matching example/main.ts", async () => {
      using writeTextFileStub = isSnapshotMode()
        ? spy(deno, "writeTextFile")
        : stub(deno, "writeTextFile");
      await using builder = new Builder({ projectRoot: exampleDir });
      await builder.buildMainServerEntrypoint();

      const exampleMainPath = path.resolve(exampleDir, "main.ts");
      const expectedContent = (await Deno.readTextFile(exampleMainPath))
        .replace(/\r\n/g, "\n");

      assertSpyCall(writeTextFileStub, 0, {
        args: [exampleMainPath, expectedContent],
      });
      assertSpyCalls(writeTextFileStub, 1);
    });
  });

  describe("buildMainClientEntrypoint", () => {
    it("should generate content matching example/main.tsx", async () => {
      using writeTextFileStub = isSnapshotMode()
        ? spy(deno, "writeTextFile")
        : stub(deno, "writeTextFile");
      await using builder = new Builder({ projectRoot: exampleDir });
      await builder.buildMainClientEntrypoint();

      const exampleMainPath = path.resolve(exampleDir, "main.tsx");
      const expectedContent = (await Deno.readTextFile(exampleMainPath))
        .replace(/\r\n/g, "\n");

      assertSpyCall(writeTextFileStub, 0, {
        args: [exampleMainPath, expectedContent],
      });
      assertSpyCalls(writeTextFileStub, 1);
    });
  });

  describe("constructor", () => {
    it("should initialize with default options", async () => {
      await using builder = new Builder();
      assertEquals(builder.projectRoot, Deno.cwd());
      assertEquals(builder.routesPath, path.resolve(Deno.cwd(), "./routes"));
      assertEquals(builder.publicPath, path.resolve(Deno.cwd(), "./public"));
    });

    it("should initialize with custom options", async () => {
      const customRoot = "/custom/path";
      await using builder = new Builder({
        projectRoot: customRoot,
        configPath: "./custom.json",
        write: false,
      });
      assertEquals(builder.projectRoot, customRoot);
      assertEquals(builder.routesPath, path.resolve(customRoot, "./routes"));
    });
  });

  describe("build", () => {
    it("should build successfully", async () => {
      await using builder = new Builder({
        projectRoot: exampleDir,
        configPath: "../deno.json",
        write: false,
      });

      const result = await builder.build();
      console.log(result);
      assertEquals(typeof result, "object");
      assertEquals(builder.isBuilding, false);
    });

    it("should throw error if build already started", async () => {
      await using builder = new Builder({
        projectRoot: exampleDir,
        configPath: "../deno.json",
        write: false,
      });

      await builder.build();

      await assertRejects(
        async () => await builder.build(),
        Error,
        "Build already started, use rebuild instead",
      );
    });
  });

  describe("rebuild", () => {
    it("should rebuild successfully after initial build", async () => {
      await using builder = new Builder({
        projectRoot: exampleDir,
        configPath: "../deno.json",
        write: false,
      });

      await builder.build();

      const result = await builder.rebuild({ server: true, client: true });
      assertEquals(typeof result, "object");
      assertEquals(builder.isBuilding, false);
    });

    it("should throw error if no build context exists", async () => {
      await using builder = new Builder({
        projectRoot: exampleDir,
        configPath: "../deno.json",
        write: false,
      });

      await assertRejects(
        async () => await builder.rebuild({ server: true, client: true }),
        Error,
        "Build already started, use rebuild instead",
      );
    });
  });

  describe("dispose", () => {
    it("should dispose context properly", async () => {
      const builder = new Builder({
        projectRoot: exampleDir,
        configPath: "../deno.json",
        write: false,
      });

      await builder.build();
      await builder.dispose();
    });
  });

  describe("isBuilding", () => {
    it("should track building state correctly", async () => {
      await using builder = new Builder({
        projectRoot: exampleDir,
        configPath: "../deno.json",
        write: false,
      });

      assertEquals(builder.isBuilding, false);

      const buildPromise = builder.build();
      await buildPromise;
      assertEquals(builder.isBuilding, false);
    });
  });
});
