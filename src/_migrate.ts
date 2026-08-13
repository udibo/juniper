/**
 * Migration utilities for detecting React Router routes and generating Juniper routes.
 *
 * @module
 */

import * as path from "@std/path";
import { walk } from "@std/fs/walk";
import { ensureDir } from "@std/fs/ensure-dir";

export interface DetectedRoute {
  path: string;
  component?: string;
  loader?: string;
  action?: string;
  middleware?: string[];
  children?: DetectedRoute[];
  file?: string;
}

export interface DetectedMiddleware {
  name: string;
  file: string;
  code: string;
}

export interface DetectionResult {
  routes: DetectedRoute[];
  middleware: DetectedMiddleware[];
  warnings: string[];
}

export interface GenerationOptions {
  dryRun?: boolean;
}

export interface GenerationResult {
  filesCreated: string[];
  filesSkipped: string[];
}

/**
 * Detects React Router routes in a source directory.
 * Looks for createBrowserRouter, createMemoryRouter, etc. calls
 * and analyzes route configurations.
 */
export async function detectReactRouterRoutes(
  sourceDir: string,
): Promise<DetectionResult> {
  const routes: DetectedRoute[] = [];
  const middleware: DetectedMiddleware[] = [];
  const warnings: string[] = [];

  // Walk through source directory looking for route files
  for await (const entry of walk(sourceDir, {
    includeDirs: false,
    exts: [".tsx", ".ts", ".jsx", ".js"],
    skip: [/node_modules/, /\.git/, /dist/, /build/],
  })) {
    try {
      const content = await Deno.readTextFile(entry.path);
      
      // Detect React Router imports
      if (!content.includes("react-router") && !content.includes("react-router-dom")) {
        continue;
      }

      // Detect createBrowserRouter, createMemoryRouter, etc.
      const routerMatches = content.matchAll(
        /create(Browser|Memory|Hash|Static)Router\s*\(\s*\[([\s\S]*?)\]/g
      );

      for (const match of routerMatches) {
        const routerType = match[1];
        const routesConfig = match[2];
        
        warnings.push(
          `Found ${routerType}Router in ${path.relative(sourceDir, entry.path)} - manual review recommended`
        );

        // Try to parse routes (simplified - real implementation would need AST parsing)
        const routeObjects = parseRouteConfig(routesConfig, entry.path);
        routes.push(...routeObjects);
      }

      // Detect route definitions with components
      const routeMatches = content.matchAll(
        /path:\s*["'`]([^"'`]+)["'`][\s\S]*?element:\s*<([^>]+)>/g
      );

      for (const match of routeMatches) {
        routes.push({
          path: match[1],
          component: match[2],
          file: path.relative(sourceDir, entry.path),
        });
      }

      // Detect middleware exports
      const middlewareMatches = content.matchAll(
        /export\s+const\s+middleware\s*=\s*\[([\s\S]*?)\]/g
      );

      for (const match of middlewareMatches) {
        middleware.push({
          name: "middleware",
          file: path.relative(sourceDir, entry.path),
          code: match[0],
        });
      }

      // Detect loader functions
      const loaderMatches = content.matchAll(
        /export\s+(async\s+)?function\s+loader\s*\(/g
      );
      if (loaderMatches) {
        // Mark file as having loaders
      }

    } catch (error) {
      warnings.push(`Failed to process ${entry.path}: ${error}`);
    }
  }

  // If no routes found, try to detect file-based routing patterns
  if (routes.length === 0) {
    const fileBasedRoutes = await detectFileBasedRoutes(sourceDir);
    routes.push(...fileBasedRoutes.routes);
    warnings.push(...fileBasedRoutes.warnings);
  }

  return {
    routes: deduplicateRoutes(routes),
    middleware,
    warnings,
  };
}

/**
 * Attempts to parse route configuration from a string.
 * This is a simplified parser - a real implementation would use AST.
 */
function parseRouteConfig(config: string, filePath: string): DetectedRoute[] {
  const routes: DetectedRoute[] = [];
  
  // Simple regex-based parsing (would be better with AST in production)
  const routeRegex = /\{\s*path:\s*["'`]([^"'`]+)["'`][^}]*\}/g;
  let match;
  
  while ((match = routeRegex.exec(config)) !== null) {
    const routePath = match[1];
    const routeBlock = match[0];
    
    const route: DetectedRoute = {
      path: routePath,
      file: filePath,
    };

    // Extract component
    const componentMatch = routeBlock.match(/element:\s*<(\w+)/);
    if (componentMatch) {
      route.component = componentMatch[1];
    }

    // Extract loader
    if (routeBlock.includes("loader:")) {
      route.loader = "loader";
    }

    // Extract action
    if (routeBlock.includes("action:")) {
      route.action = "action";
    }

    routes.push(route);
  }

  return routes;
}

/**
 * Detects file-based routing patterns in the source directory.
 */
async function detectFileBasedRoutes(
  sourceDir: string,
): Promise<{ routes: DetectedRoute[]; warnings: string[] }> {
  const routes: DetectedRoute[] = [];
  const warnings: string[] = [];

  // Common React Router file patterns
  const routePatterns = [
    "routes",
    "pages",
    "app/routes",
    "src/routes",
    "src/pages",
  ];

  for (const pattern of routePatterns) {
    const routesDir = path.join(sourceDir, pattern);
    try {
      const stat = await Deno.stat(routesDir);
      if (stat.isDirectory) {
        warnings.push(`Found potential routes directory: ${pattern}`);
        
        for await (const entry of walk(routesDir, { includeDirs: false })) {
          if (entry.name.endsWith(".tsx") || entry.name.endsWith(".jsx")) {
            const relativePath = path.relative(routesDir, entry.path);
            const routePath = convertFilePathToRoute(relativePath);
            
            routes.push({
              path: routePath,
              component: path.basename(entry.path, path.extname(entry.path)),
              file: path.relative(sourceDir, entry.path),
            });
          }
        }
      }
    } catch {
      // Directory doesn't exist, continue
    }
  }

  return { routes, warnings };
}

/**
 * Converts a file path to a route path.
 * e.g., "blog/[id].tsx" -> "/blog/:id"
 */
function convertFilePathToRoute(filePath: string): string {
  let route = filePath
    .replace(/\.(tsx|jsx|ts|js)$/, "")
    .replace(/\/index$/, "")
    .replace(/\[([^]]+)\]/g, ":$1");
  
  if (!route.startsWith("/")) {
    route = "/" + route;
  }
  
  if (route === "/") {
    return "/";
  }
  
  return route;
}

/**
 * Deduplicates routes by path.
 */
function deduplicateRoutes(routes: DetectedRoute[]): DetectedRoute[] {
  const seen = new Set<string>();
  return routes.filter(route => {
    if (seen.has(route.path)) {
      return false;
    }
    seen.add(route.path);
    return true;
  });
}

/**
 * Generates Juniper route files from detected routes.
 */
export async function generateJuniperRoutes(
  detection: DetectionResult,
  targetDir: string,
  options: GenerationOptions = {},
): Promise<GenerationResult> {
  const filesCreated: string[] = [];
  const filesSkipped: string[] = [];

  if (!options.dryRun) {
    await ensureDir(targetDir);
  }

  // Generate route files
  for (const route of detection.routes) {
    const result = await generateRouteFile(route, targetDir, options);
    if (result.created) {
      filesCreated.push(result.path);
    } else {
      filesSkipped.push(result.path);
    }
  }

  // Generate middleware files if any
  if (detection.middleware.length > 0) {
    const middlewareDir = path.join(targetDir, "_middleware");
    if (!options.dryRun) {
      await ensureDir(middlewareDir);
    }

    for (const mw of detection.middleware) {
      const mwPath = path.join(middlewareDir, path.basename(mw.file));
      if (!options.dryRun) {
        await Deno.writeTextFile(mwPath, mw.code);
      }
      filesCreated.push(mwPath);
    }
  }

  // Generate a main.tsx file if it doesn't exist
  const mainTsxPath = path.join(targetDir, "main.tsx");
  const mainExists = await exists(mainTsxPath);
  
  if (!mainExists && !options.dryRun) {
    const mainContent = generateMainTsx();
    await Deno.writeTextFile(mainTsxPath, mainContent);
    filesCreated.push(mainTsxPath);
  }

  return { filesCreated, filesSkipped };
}

/**
 * Generates a single Juniper route file.
 */
async function generateRouteFile(
  route: DetectedRoute,
  targetDir: string,
  options: GenerationOptions,
): Promise<{ path: string; created: boolean }> {
  // Convert route path to file path
  // e.g., "/blog/:id" -> "blog/[id]/index.tsx"
  let filePath = route.path
    .replace(/^\/+/, "")
    .replace(/:([^/]+)/g, "[$1]");
  
  if (!filePath || filePath === "") {
    filePath = "index";
  } else {
    filePath = path.join(filePath, "index");
  }
  
  filePath += ".tsx";
  const fullPath = path.join(targetDir, filePath);

  // Check if file exists
  if (await exists(fullPath) && !options.dryRun) {
    return { path: fullPath, created: false };
  }

  // Ensure directory exists
  const dir = path.dirname(fullPath);
  if (!options.dryRun) {
    await ensureDir(dir);
  }

  // Generate file content
  const content = generateRouteContent(route);

  if (!options.dryRun) {
    await Deno.writeTextFile(fullPath, content);
  }

  return { path: fullPath, created: true };
}

/**
 * Generates the content for a Juniper route file.
 */
function generateRouteContent(route: DetectedRoute): string {
  const imports: string[] = [];
  const exports: string[] = [];

  // Add React import if component exists
  if (route.component) {
    imports.push(`import type { RouteProps } from "@udibo/juniper";`);
  }

  // Add middleware import if needed
  if (route.middleware && route.middleware.length > 0) {
    imports.push(`import type { MiddlewareFunction } from "@udibo/juniper";`);
    exports.push(`
export const middleware: MiddlewareFunction[] = [
  // TODO: Migrate middleware from ${route.middleware.join(", ")}
  async ({ context, request }, next) => {
    console.log("Middleware for ${route.path}");
    return next();
  },
];`);
  }

  // Add loader if exists
  if (route.loader) {
    imports.push(`import type { RouteLoaderArgs } from "@udibo/juniper";`);
    exports.push(`
export async function loader({ params, request, context }: RouteLoaderArgs) {
  // TODO: Migrate loader logic from ${route.loader}
  return { message: "Loaded data for ${route.path}" };
}`);
  }

  // Add action if exists
  if (route.action) {
    imports.push(`import type { RouteActionArgs } from "@udibo/juniper";`);
    exports.push(`
export async function action({ params, request, context }: RouteActionArgs) {
  // TODO: Migrate action logic from ${route.action}
  return { success: true };
}`);
  }

  // Add component
  let componentCode = "";
  if (route.component) {
    componentCode = `
export default function ${pascalCase(route.component)}Route({ loaderData }: RouteProps) {
  return (
    <div>
      <h1>${route.path} Route</h1>
      <p>This route was auto-generated from React Router config.</p>
      {loaderData && <pre>{JSON.stringify(loaderData, null, 2)}</pre>}
    </div>
  );
}`;
  } else {
    componentCode = `
export default function Route() {
  return (
    <div>
      <h1>${route.path}</h1>
      <p>Auto-generated route. Replace with your component.</p>
    </div>
  );
}`;
  }

  return `${imports.join("\n")}

${exports.join("\n\n")}
${componentCode}
`;
}

/**
 * Generates a basic main.tsx file.
 */
function generateMainTsx(): string {
  return `import { Outlet } from "react-router";
import type { ErrorBoundaryProps } from "@udibo/juniper";

export default function Main() {
  return (
    <main>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <Outlet />
    </main>
  );
}

export function ErrorBoundary({ error, resetErrorBoundary }: ErrorBoundaryProps) {
  return (
    <div>
      <h1>Error</h1>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
`;
}

/**
 * Converts a string to PascalCase.
 */
function pascalCase(str: string): string {
  return str
    .replace(/(^\w|-\w)/g, (match) => match.replace("-", "").toUpperCase())
    .replace(/\W/g, "");
}

/**
 * Check if a file exists.
 */
async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}
