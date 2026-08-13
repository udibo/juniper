import { assertEquals, assertExists } from "@std/assert";
import { beforeEach, afterEach, describe, it } from "@std/testing/bdd";
import * as path from "@std/path";

import {
  detectRoutes,
  displayDetectionResults,
  migrateRoutes,
} from "./cli.ts";

const testDir = path.resolve(
  path.dirname(path.fromFileUrl(import.meta.url)),
  "../test-fixtures/cli-test",
);

describe("CLI", () => {
  beforeEach(async () => {
    // Create test directory structure
    await Deno.mkdir(path.join(testDir, "routes"), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await Deno.remove(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("detectRoutes", () => {
    it("should detect empty routes directory", async () => {
      const result = await detectRoutes(testDir, "./routes");
      
      assertEquals(result.totalRoutes, 0);
      assertEquals(result.routesWithMiddleware, 0);
      assertEquals(result.reactRouterRoutes, 0);
      assertEquals(result.juniperRoutes, 0);
    });

    it("should detect Juniper routes", async () => {
      await Deno.writeTextFile(
        path.join(testDir, "routes", "index.tsx"),
        `import type { MiddlewareFunction } from "@udibo/juniper";

export const middleware: MiddlewareFunction[] = [];

export default function Index() {
  return <div>Index</div>;
}
`,
      );

      const result = await detectRoutes(testDir, "./routes");
      
      assertEquals(result.totalRoutes, 1);
      assertEquals(result.routesWithMiddleware, 1);
      assertEquals(result.juniperRoutes, 1);
      assertEquals(result.reactRouterRoutes, 0);
      assertEquals(result.routes[0].path, "/");
      assertEquals(result.routes[0].hasMiddleware, true);
    });

    it("should detect React Router routes", async () => {
      await Deno.writeTextFile(
        path.join(testDir, "routes", "dashboard.tsx"),
        `import type { MiddlewareFunction } from "react-router";

export const middleware: MiddlewareFunction[] = [];

export default function Dashboard() {
  return <div>Dashboard</div>;
}
`,
      );

      const result = await detectRoutes(testDir, "./routes");
      
      assertEquals(result.totalRoutes, 1);
      assertEquals(result.routesWithMiddleware, 1);
      assertEquals(result.reactRouterRoutes, 1);
      assertEquals(result.juniperRoutes, 0);
      assertEquals(result.routes[0].path, "/dashboard");
    });

    it("should detect routes with loaders and actions", async () => {
      await Deno.writeTextFile(
        path.join(testDir, "routes", "blog.tsx"),
        `export async function loader() {
  return { posts: [] };
}

export async function action() {
  return { success: true };
}

export default function Blog() {
  return <div>Blog</div>;
}
`,
      );

      const result = await detectRoutes(testDir, "./routes");
      
      assertEquals(result.totalRoutes, 1);
      assertEquals(result.routes[0].hasLoader, true);
      assertEquals(result.routes[0].hasAction, true);
      assertEquals(result.routes[0].hasMiddleware, false);
    });

    it("should detect dynamic routes", async () => {
      await Deno.mkdir(path.join(testDir, "routes", "blog", "[id]"), { recursive: true });
      await Deno.writeTextFile(
        path.join(testDir, "routes", "blog", "[id]", "index.tsx"),
        `export default function BlogPost() {
  return <div>Post</div>;
}
`,
      );

      const result = await detectRoutes(testDir, "./routes");
      
      assertEquals(result.totalRoutes, 1);
      assertEquals(result.routes[0].path, "/blog/:id");
    });

    it("should detect catch-all routes", async () => {
      await Deno.writeTextFile(
        path.join(testDir, "routes", "[...].tsx"),
        `export default function CatchAll() {
  return <div>404</div>;
}
`,
      );

      const result = await detectRoutes(testDir, "./routes");
      
      assertEquals(result.totalRoutes, 1);
      assertEquals(result.routes[0].path, "/*");
    });
  });

  describe("displayDetectionResults", () => {
    it("should display results without error", () => {
      const result = {
        routes: [
          {
            path: "/",
            filePath: "index.tsx",
            hasMiddleware: true,
            middlewareCount: 1,
            hasLoader: false,
            hasAction: false,
            framework: "juniper" as const,
          },
        ],
        totalRoutes: 1,
        routesWithMiddleware: 1,
        reactRouterRoutes: 0,
        juniperRoutes: 1,
      };

      // Should not throw
      displayDetectionResults(result);
    });
  });

  describe("migrateRoutes", () => {
    it("should handle empty results", async () => {
      const result = {
        routes: [],
        totalRoutes: 0,
        routesWithMiddleware: 0,
        reactRouterRoutes: 0,
        juniperRoutes: 0,
      };

      // Should not throw
      await migrateRoutes(result, { projectRoot: testDir, dryRun: true, yes: true });
    });

    it("should migrate React Router routes in dry-run mode", async () => {
      await Deno.writeTextFile(
        path.join(testDir, "routes", "test.tsx"),
        `import type { MiddlewareFunction } from "react-router";

export const middleware: MiddlewareFunction[] = [];

export default function Test() {
  return <div>Test</div>;
}
`,
      );

      const result = await detectRoutes(testDir, "./routes");
      
      assertEquals(result.reactRouterRoutes, 1);
      
      // Should not throw in dry-run mode
      await migrateRoutes(result, { 
        projectRoot: testDir, 
        dryRun: true, 
        yes: true 
      });
    });
  });
});
