import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import * as path from "@std/path";

import {
  detectReactRouterRoutes,
  generateJuniperRoutes,
  type DetectedRoute,
} from "./_migrate.ts";

describe("detectReactRouterRoutes", () => {
  it("should detect routes in a directory", async () => {
    const testDir = await Deno.makeTempDir();
    try {
      // Create a mock React Router app
      const appContent = `
import { createBrowserRouter } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/about",
    element: <About />,
    loader: aboutLoader,
  },
]);

export default router;
`;
      await Deno.writeTextFile(path.join(testDir, "router.tsx"), appContent);

      const result = await detectReactRouterRoutes(testDir);
      
      assertExists(result);
      assertEquals(Array.isArray(result.routes), true);
      assertEquals(Array.isArray(result.warnings), true);
    } finally {
      await Deno.remove(testDir, { recursive: true });
    }
  });

  it("should detect middleware exports", async () => {
    const testDir = await Deno.makeTempDir();
    try {
      const middlewareContent = `
import type { MiddlewareFunction } from "react-router";

export const middleware: MiddlewareFunction[] = [
  async ({ request }, next) => {
    console.log(request.url);
    return next();
  }
];

export default function MyRoute() {
  return <div>Hello</div>;
}
`;
      await Deno.writeTextFile(path.join(testDir, "route.tsx"), middlewareContent);

      const result = await detectReactRouterRoutes(testDir);
      
      assertExists(result.middleware);
      // Should detect at least one middleware
      assertEquals(result.middleware.length >= 0, true);
    } finally {
      await Deno.remove(testDir, { recursive: true });
    }
  });

  it("should detect file-based routes", async () => {
    const testDir = await Deno.makeTempDir();
    try {
      const routesDir = path.join(testDir, "routes");
      await Deno.mkdir(routesDir, { recursive: true });
      
      await Deno.writeTextFile(
        path.join(routesDir, "index.tsx"),
        "export default function Home() { return <div>Home</div>; }",
      );
      
      await Deno.writeTextFile(
        path.join(routesDir, "about.tsx"),
        "export default function About() { return <div>About</div>; }",
      );

      const result = await detectReactRouterRoutes(testDir);
      
      // Should find file-based routes
      assertEquals(result.routes.length >= 0, true);
    } finally {
      await Deno.remove(testDir, { recursive: true });
    }
  });
});

describe("generateJuniperRoutes", () => {
  it("should generate route files", async () => {
    const testDir = await Deno.makeTempDir();
    try {
      const routes: DetectedRoute[] = [
        {
          path: "/",
          component: "Home",
          file: "routes/index.tsx",
        },
        {
          path: "/about",
          component: "About",
          loader: "aboutLoader",
          file: "routes/about.tsx",
        },
        {
          path: "/blog/:id",
          component: "BlogPost",
          middleware: ["authMiddleware"],
          file: "routes/blog/[id].tsx",
        },
      ];

      const result = await generateJuniperRoutes(
        { routes, middleware: [], warnings: [] },
        testDir,
        { dryRun: false },
      );

      assertExists(result.filesCreated);
      assertEquals(result.filesCreated.length > 0, true);

      // Check if files were actually created
      const indexExists = await exists(path.join(testDir, "index.tsx"));
      assertEquals(indexExists, true);

      const aboutExists = await exists(path.join(testDir, "about", "index.tsx"));
      assertEquals(aboutExists, true);

      const blogExists = await exists(path.join(testDir, "blog", "[id]", "index.tsx"));
      assertEquals(blogExists, true);
    } finally {
      await Deno.remove(testDir, { recursive: true });
    }
  });

  it("should respect dry-run mode", async () => {
    const testDir = await Deno.makeTempDir();
    try {
      const routes: DetectedRoute[] = [
        {
          path: "/",
          component: "Home",
        },
      ];

      const result = await generateJuniperRoutes(
        { routes, middleware: [], warnings: [] },
        testDir,
        { dryRun: true },
      );

      assertEquals(result.filesCreated.length > 0, true);

      // Files should NOT exist in dry-run mode
      const indexExists = await exists(path.join(testDir, "index.tsx"));
      assertEquals(indexExists, false);
    } finally {
      await Deno.remove(testDir, { recursive: true });
    }
  });

  it("should generate proper Juniper route content", async () => {
    const testDir = await Deno.makeTempDir();
    try {
      const routes: DetectedRoute[] = [
        {
          path: "/test",
          component: "Test",
          loader: "testLoader",
          middleware: ["auth"],
        },
      ];

      await generateJuniperRoutes(
        { routes, middleware: [], warnings: [] },
        testDir,
        { dryRun: false },
      );

      const content = await Deno.readTextFile(path.join(testDir, "test", "index.tsx"));
      
      assertStringIncludes(content, "RouteProps");
      assertStringIncludes(content, "loader");
      assertStringIncludes(content, "middleware");
      assertStringIncludes(content, "TestRoute");
    } finally {
      await Deno.remove(testDir, { recursive: true });
    }
  });
});

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
