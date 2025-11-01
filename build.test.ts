import { assertEquals, assertRejects } from "@std/assert";
import * as path from "@std/path";
import { describe, it } from "@std/testing/bdd";
import { assertSpyCall, assertSpyCalls, spy, stub } from "@std/testing/mock";

import { Builder } from "@udibo/juniper/build";
import { isSnapshotMode } from "@udibo/juniper/utils/testing";

import { deno } from "./deno.ts";
import {
  generatedRouteObjectToString,
  isClientCatchallRoute,
  isClientDynamicRoute,
  processClientDirectory,
  processDirectory,
} from "./_build.ts";

const exampleDir = path.resolve(
  path.dirname(path.fromFileUrl(import.meta.url)),
  "example",
);

describe("Builder", () => {
  describe("internal helpers (_build)", () => {
    it("should identify client route types (dynamic and catchall)", () => {
      assertEquals(isClientDynamicRoute("[id].tsx"), true);
      assertEquals(isClientDynamicRoute("index.tsx"), false);
      assertEquals(isClientCatchallRoute("[...].tsx"), true);
      assertEquals(isClientCatchallRoute("[id].tsx"), false);
    });

    it("should build server and client route trees with params and catchall", async () => {
      const tmp = await Deno.makeTempDir();
      const routesDir = path.resolve(tmp, "routes");
      await Deno.mkdir(routesDir, { recursive: true });
      // server routes
      await Deno.writeTextFile(
        path.resolve(routesDir, "main.ts"),
        "export const default_ = {} as unknown as any;\nexport default default_\n",
      );
      await Deno.writeTextFile(
        path.resolve(routesDir, "index.ts"),
        "export const default_ = {} as unknown as any;\nexport default default_\n",
      );
      await Deno.mkdir(path.resolve(routesDir, "[user]"));
      await Deno.writeTextFile(
        path.resolve(routesDir, "[user]", "main.ts"),
        "export const default_ = {} as unknown as any;\nexport default default_\n",
      );
      await Deno.mkdir(path.resolve(routesDir, "api"));
      await Deno.writeTextFile(
        path.resolve(routesDir, "api", "[...].ts"),
        "export const default_ = {} as unknown as any;\nexport default default_\n",
      );

      const clientRoutesDir = routesDir; // client uses same root, but .tsx
      await Deno.writeTextFile(
        path.resolve(clientRoutesDir, "main.tsx"),
        "export default function X(){}\n",
      );
      await Deno.writeTextFile(
        path.resolve(clientRoutesDir, "index.tsx"),
        "export default function X(){}\n",
      );
      await Deno.writeTextFile(
        path.resolve(clientRoutesDir, "[id].tsx"),
        "export default function X(){}\n",
      );
      await Deno.mkdir(path.resolve(clientRoutesDir, "blog"));
      await Deno.writeTextFile(
        path.resolve(clientRoutesDir, "blog", "[...].tsx"),
        "export default function X(){}\n",
      );

      try {
        const importBase = ("./" + path.relative(tmp, routesDir)).replace(
          /\\\\/g,
          "/",
        );
        const serverProps = await processDirectory(routesDir, importBase);
        const clientProps = await processClientDirectory(
          clientRoutesDir,
          importBase,
          true,
        );

        // server side
        const serverChildren = [
          ...serverProps.fileModuleChildren,
          ...serverProps.parameterizedChildren,
          ...serverProps.directoryChildren,
        ];
        assertEquals(Boolean(serverProps.main), true);
        assertEquals(Boolean(serverProps.index), true);
        // has parameterized dir child and a catchall route under api
        assertEquals(serverChildren.some((c) => c.path === ":user"), true);
        assertEquals(serverChildren.some((c) => c.path === "api"), true);

        // client side
        const clientChildren = [
          ...clientProps.fileModuleChildren,
          ...clientProps.parameterizedChildren,
          ...clientProps.directoryChildren,
        ];
        assertEquals(Boolean(clientProps.main), true); // root main uses await import
        assertEquals(Boolean(clientProps.index), true);
        assertEquals(clientChildren.some((c) => c.path === ":id"), true);
        assertEquals(clientChildren.some((c) => c.path === "blog"), true);

        // spot check generatedRouteObjectToString formatting for a tiny object
        const s = generatedRouteObjectToString({
          path: "/",
          children: [{ path: ":id" }],
        }, 1);
        assertEquals(typeof s, "string");
        assertEquals(s.includes(":id"), true);
      } finally {
        await Deno.remove(tmp, { recursive: true });
      }
    });

    it("should stringify generated route object deterministically", () => {
      const str = generatedRouteObjectToString({
        path: "/",
        main: 'await import("./routes/main.ts")',
        children: [
          { path: "about", main: '() => import("./routes/about.tsx")' },
          { path: ":id" },
        ],
      }, 1);
      const expected = `{
    path: "/",
    main: await import("./routes/main.ts"),
    children: [
      {
        path: "about",
        main: () => import("./routes/about.tsx")
      },
      {
        path: ":id"
      }
    ]
  }`;
      assertEquals(str, expected);
    });
  });
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
