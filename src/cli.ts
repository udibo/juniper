/**
 * CLI utilities for Juniper applications.
 *
 * Provides commands for detecting and migrating routes and middleware
 * from existing React Router applications.
 *
 * @module
 */
import { walk } from "@std/fs";
import * as path from "@std/path";
import { parseArgs } from "@std/cli/parse-args";

interface DetectedRoute {
  path: string;
  filePath: string;
  hasMiddleware: boolean;
  middlewareCount: number;
  hasLoader: boolean;
  hasAction: boolean;
  framework: "react-router" | "juniper" | "unknown";
}

interface DetectionResult {
  routes: DetectedRoute[];
  totalRoutes: number;
  routesWithMiddleware: number;
  reactRouterRoutes: number;
  juniperRoutes: number;
}

interface MigrateOptions {
  projectRoot?: string;
  routesDir?: string;
  dryRun?: boolean;
  yes?: boolean;
}

/**
 * Available middleware adapter templates.
 */
export const ADAPTER_TEMPLATES = {
  auth: ["requireAuth", "optionalAuth", "requireRole"],
  logging: ["requestLogger", "performanceMonitor"],
  error: ["errorBoundary", "requireContext"],
  security: ["cors", "rateLimit"],
  context: ["setContext", "mergeContext"],
} as const;

/**
 * Generates a middleware adapter file.
 *
 * @param type - The type of adapter
 * @param name - The name of the adapter
 * @param outputPath - Where to write the file
 */
export async function generateAdapter(
  type: keyof typeof ADAPTER_TEMPLATES,
  name: string,
  outputPath: string,
): Promise<void> {
  const templates: Record<string, string> = {
    requireAuth: `import { authAdapters, type MiddlewareFunction } from "@udibo/juniper/adapters";
import { userContext } from "@/context/user";

export const middleware: MiddlewareFunction[] = [
  authAdapters.requireAuth({
    userContext,
    loginPath: "/login",
  }),
];
`,
    optionalAuth: `import { authAdapters, type MiddlewareFunction } from "@udibo/juniper/adapters";
import { userContext } from "@/context/user";

export const middleware: MiddlewareFunction[] = [
  authAdapters.optionalAuth({
    userContext,
    getUser: async (request) => {
      const token = request.headers.get("Authorization");
      // Implement your user fetching logic
      return token ? { id: "1", name: "User" } : null;
    },
  }),
];
`,
    requireRole: `import { authAdapters, type MiddlewareFunction } from "@udibo/juniper/adapters";
import { userContext } from "@/context/user";

export const middleware: MiddlewareFunction[] = [
  authAdapters.requireRole({
    userContext,
    roles: ["admin"],
    unauthorizedPath: "/unauthorized",
  }),
];
`,
    requestLogger: `import { loggingAdapters, type MiddlewareFunction } from "@udibo/juniper/adapters";

export const middleware: MiddlewareFunction[] = [
  loggingAdapters.requestLogger({
    logHeaders: false,
    excludePaths: ["/health", "/metrics"],
  }),
];
`,
    performanceMonitor: `import { loggingAdapters, type MiddlewareFunction } from "@udibo/juniper/adapters";

export const middleware: MiddlewareFunction[] = [
  loggingAdapters.performanceMonitor({
    slowThreshold: 1000,
    onSlowRequest: ({ url, duration }) => {
      console.warn(\`Slow request to \${url}: \${duration}ms\`);
    },
  }),
];
`,
    errorBoundary: `import { errorAdapters, type MiddlewareFunction } from "@udibo/juniper/adapters";

export const middleware: MiddlewareFunction[] = [
  errorAdapters.errorBoundary({
    onError: (error, { request }) => {
      console.error(\`Error on \${request.url}:\`, error);
    },
    redirectOnError: "/error",
  }),
];
`,
    requireContext: `import { errorAdapters, type MiddlewareFunction } from "@udibo/juniper/adapters";
import { userContext, settingsContext } from "@/context";

export const middleware: MiddlewareFunction[] = [
  errorAdapters.requireContext(userContext, settingsContext),
];
`,
    cors: `import { securityAdapters, type MiddlewareFunction } from "@udibo/juniper/adapters";

export const middleware: MiddlewareFunction[] = [
  securityAdapters.cors({
    origin: ["https://example.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
];
`,
    rateLimit: `import { securityAdapters, type MiddlewareFunction } from "@udibo/juniper/adapters";

export const middleware: MiddlewareFunction[] = [
  securityAdapters.rateLimit({
    maxRequests: 100,
    windowMs: 60000,
  }),
];
`,
    setContext: `import { contextAdapters, type MiddlewareFunction } from "@udibo/juniper/adapters";
import { themeContext } from "@/context";

export const middleware: MiddlewareFunction[] = [
  contextAdapters.setContext(
    new Map([
      [themeContext, "dark"],
    ])
  ),
];
`,
  };

  const content = templates[name];
  if (!content) {
    throw new Error(`Unknown adapter: ${name}`);
  }

  await Deno.writeTextFile(outputPath, content);
}

/**
 * Detects routes and middleware in a project.
 *
 * @param projectRoot - The root directory of the project
 * @param routesDir - The directory containing routes (defaults to "./routes")
 * @returns Detection results
 */
export async function detectRoutes(
  projectRoot: string = Deno.cwd(),
  routesDir: string = "./routes",
): Promise<DetectionResult> {
  const absoluteRoutesDir = path.resolve(projectRoot, routesDir);
  const routes: DetectedRoute[] = [];

  if (!(await exists(absoluteRoutesDir))) {
    return {
      routes: [],
      totalRoutes: 0,
      routesWithMiddleware: 0,
      reactRouterRoutes: 0,
      juniperRoutes: 0,
    };
  }

  for await (const entry of walk(absoluteRoutesDir, {
    includeDirs: false,
    exts: [".tsx", ".ts", ".jsx", ".js"],
  })) {
    const relativePath = path.relative(absoluteRoutesDir, entry.path);
    const routePath = getRoutePathFromFile(relativePath);
    
    try {
      const content = await Deno.readTextFile(entry.path);
      const detection = analyzeFile(content, entry.path);
      
      routes.push({
        path: routePath,
        filePath: relativePath,
        ...detection,
      });
    } catch (error) {
      console.warn(`Warning: Could not read ${entry.path}:`, error);
    }
  }

  return {
    routes,
    totalRoutes: routes.length,
    routesWithMiddleware: routes.filter(r => r.hasMiddleware).length,
    reactRouterRoutes: routes.filter(r => r.framework === "react-router").length,
    juniperRoutes: routes.filter(r => r.framework === "juniper").length,
  };
}

function getRoutePathFromFile(filePath: string): string {
  // Convert file path to route path
  // e.g., "blog/[id]/index.tsx" -> "/blog/:id"
  // e.g., "dashboard.tsx" -> "/dashboard"
  // e.g., "index.tsx" -> "/"
  
  let routePath = filePath
    .replace(/\.(tsx|ts|jsx|js)$/, "")
    .replace(/\/index$/, "")
    .replace(/\/main$/, "")
    .replace(/^index$/, "")
    .replace(/^main$/, "");
  
  // Convert [id] to :id
  routePath = routePath.replace(/\[(\w+)\]/g, ":$1");
  
  // Handle catch-all [...].tsx -> *
  routePath = routePath.replace(/\[\.\.\.\]/g, "*");
  
  if (routePath === "" || routePath === "/") {
    return "/";
  }
  
  return "/" + routePath;
}

function analyzeFile(content: string, filePath: string): Omit<DetectedRoute, "path" | "filePath"> {
  const hasMiddleware = /export\s+(const|let|var)\s+middleware\s*[=:]/.test(content) ||
                       /export\s*\{[^}]*middleware[^}]*\}/.test(content);
  
  const middlewareMatches = content.match(/middleware\s*:\s*\[/g);
  const middlewareCount = middlewareMatches ? middlewareMatches.length : 0;
  
  const hasLoader = /export\s+(async\s+)?function\s+loader\b/.test(content) ||
                    /export\s+const\s+loader\b/.test(content);
  
  const hasAction = /export\s+(async\s+)?function\s+action\b/.test(content) ||
                    /export\s+const\s+action\b/.test(content);
  
  // Detect framework
  let framework: DetectedRoute["framework"] = "unknown";
  if (content.includes("@udibo/juniper") || content.includes("from \"@udibo/juniper\"")) {
    framework = "juniper";
  } else if (content.includes("react-router") || filePath.includes("react-router")) {
    framework = "react-router";
  }
  
  return {
    hasMiddleware,
    middlewareCount,
    hasLoader,
    hasAction,
    framework,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Displays detection results to the user.
 */
export function displayDetectionResults(result: DetectionResult): void {
  console.log("\n📊 Route Detection Results");
  console.log("=========================\n");
  
  console.log(`Total routes found: ${result.totalRoutes}`);
  console.log(`Routes with middleware: ${result.routesWithMiddleware}`);
  console.log(`React Router routes: ${result.reactRouterRoutes}`);
  console.log(`Juniper routes: ${result.juniperRoutes}\n`);
  
  if (result.routes.length > 0) {
    console.log("Routes:");
    console.log("-------");
    for (const route of result.routes) {
      const middlewareInfo = route.hasMiddleware 
        ? ` [middleware: ${route.middlewareCount}]` 
        : "";
      const frameworkInfo = route.framework !== "unknown" 
        ? ` (${route.framework})` 
        : "";
      console.log(`  ${route.path} -> ${route.filePath}${middlewareInfo}${frameworkInfo}`);
    }
    console.log();
  }
}

/**
 * Prompts user for confirmation.
 */
async function confirm(message: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  await Deno.stdout.write(encoder.encode(`${message} (y/N): `));
  
  const buffer = new Uint8Array(1024);
  const n = await Deno.stdin.read(buffer);
  
  if (n === null) return false;
  
  const answer = decoder.decode(buffer.subarray(0, n)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

/**
 * Migrates detected routes to Juniper format.
 */
export async function migrateRoutes(
  result: DetectionResult,
  options: MigrateOptions = {},
): Promise<void> {
  const projectRoot = options.projectRoot || Deno.cwd();
  const dryRun = options.dryRun || false;
  
  console.log("\n🔄 Migration Plan");
  console.log("================\n");
  
  const reactRouterRoutes = result.routes.filter(r => r.framework === "react-router");
  
  if (reactRouterRoutes.length === 0) {
    console.log("No React Router routes found to migrate.");
    return;
  }
  
  console.log(`Found ${reactRouterRoutes.length} React Router routes to migrate:\n`);
  
  for (const route of reactRouterRoutes) {
    console.log(`  ${route.path} (${route.filePath})`);
    if (route.hasMiddleware) {
      console.log(`    - Has middleware (${route.middlewareCount} middleware)`);
    }
    if (route.hasLoader) {
      console.log(`    - Has loader`);
    }
    if (route.hasAction) {
      console.log(`    - Has action`);
    }
  }
  
  console.log();
  
  if (dryRun) {
    console.log("🔍 Dry run mode - no changes will be made");
    console.log("\nWould migrate the above routes to Juniper format.");
    return;
  }
  
  if (!options.yes) {
    const confirmed = await confirm("Proceed with migration?");
    if (!confirmed) {
      console.log("Migration cancelled.");
      return;
    }
  }
  
  console.log("\n🚀 Starting migration...\n");
  
  for (const route of reactRouterRoutes) {
    const filePath = path.join(projectRoot, "routes", route.filePath);
    try {
      const content = await Deno.readTextFile(filePath);
      const migrated = migrateFileContent(content, route);
      
      if (migrated !== content) {
        await Deno.writeTextFile(filePath, migrated);
        console.log(`✅ Migrated ${route.filePath}`);
      } else {
        console.log(`⏭️  No changes needed for ${route.filePath}`);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate ${route.filePath}:`, error);
    }
  }
  
  console.log("\n✨ Migration complete!");
}

function migrateFileContent(content: string, route: DetectedRoute): string {
  let migrated = content;
  
  // Add Juniper imports if not present
  if (route.framework === "react-router" && !content.includes("@udibo/juniper")) {
    // Replace react-router imports with juniper imports for types
    migrated = migrated.replace(
      /from\s+["']react-router["']/g,
      'from "@udibo/juniper"'
    );
  }
  
  // Ensure middleware is properly typed
  if (route.hasMiddleware && !content.includes("MiddlewareFunction")) {
    migrated = `import type { MiddlewareFunction } from "@udibo/juniper";\n` + migrated;
  }
  
  return migrated;
}

/**
 * Main CLI entry point.
 */
export async function runCLI(args: string[] = Deno.args): Promise<void> {
  const parsed = parseArgs(args, {
    boolean: ["dry-run", "yes", "help"],
    string: ["project-root", "routes-dir"],
    alias: {
      "dry-run": "d",
      "project-root": "p",
      "routes-dir": "r",
      "help": "h",
      "yes": "y",
    },
    default: {
      "project-root": Deno.cwd(),
      "routes-dir": "./routes",
      "dry-run": false,
      "yes": false,
      "help": false,
    },
  });
  
  if (parsed.help || parsed._[0] === "help") {
    showHelp();
    return;
  }
  
  const command = parsed._[0] || "detect";
  
  switch (command) {
    case "detect": {
      const result = await detectRoutes(
        parsed["project-root"] as string,
        parsed["routes-dir"] as string,
      );
      displayDetectionResults(result);
      break;
    }
    
    case "migrate": {
      const result = await detectRoutes(
        parsed["project-root"] as string,
        parsed["routes-dir"] as string,
      );
      displayDetectionResults(result);
      await migrateRoutes(result, {
        projectRoot: parsed["project-root"] as string,
        routesDir: parsed["routes-dir"] as string,
        dryRun: parsed["dry-run"] as boolean,
        yes: parsed["yes"] as boolean,
      });
      break;
    }
    
    case "generate": {
      const subcommand = parsed._[1];
      if (subcommand === "adapter") {
        const type = parsed._[2] as keyof typeof ADAPTER_TEMPLATES;
        const name = parsed._[3] as string;
        const output = parsed._[4] as string || `./${name}-middleware.ts`;
        
        if (!type || !name) {
          console.error("Usage: generate adapter <type> <name> [output]");
          console.log("\nAvailable types:");
          for (const [t, adapters] of Object.entries(ADAPTER_TEMPLATES)) {
            console.log(`  ${t}: ${adapters.join(", ")}`);
          }
          Deno.exit(1);
        }
        
        await generateAdapter(type, name, output);
        console.log(`✅ Generated ${name} adapter at ${output}`);
      } else {
        console.error(`Unknown generate subcommand: ${subcommand}`);
        showHelp();
        Deno.exit(1);
      }
      break;
    }
    
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      Deno.exit(1);
  }
}

function showHelp(): void {
  console.log(`
Juniper CLI - Route Detection and Migration Tool

USAGE:
  deno run -A @udibo/juniper/cli [command] [options]

COMMANDS:
  detect                    Detect routes and middleware in the project (default)
  migrate                   Detect and migrate React Router routes to Juniper
  generate adapter <type> <name> [output]  Generate middleware adapter
  help                      Show this help message

OPTIONS:
  -p, --project-root <path>  Project root directory (default: current directory)
  -r, --routes-dir <path>    Routes directory (default: ./routes)
  -d, --dry-run              Show what would be migrated without making changes
  -y, --yes                  Skip confirmation prompts
  -h, --help                 Show help

ADAPTER TYPES:
  auth:      requireAuth, optionalAuth, requireRole
  logging:   requestLogger, performanceMonitor
  error:     errorBoundary, requireContext
  security:  cors, rateLimit
  context:   setContext, mergeContext

EXAMPLES:
  # Detect routes in current project
  deno run -A @udibo/juniper/cli detect

  # Detect routes in specific directory
  deno run -A @udibo/juniper/cli detect --routes-dir ./src/routes

  # Migrate React Router routes (with confirmation)
  deno run -A @udibo/juniper/cli migrate

  # Dry run migration
  deno run -A @udibo/juniper/cli migrate --dry-run

  # Migrate without confirmation
  deno run -A @udibo/juniper/cli migrate --yes

  # Generate auth middleware adapter
  deno run -A @udibo/juniper/cli generate adapter auth requireAuth

  # Generate logging adapter with custom output
  deno run -A @udibo/juniper/cli generate adapter logging requestLogger ./middleware/logger.ts
`);
}

if (import.meta.main) {
  await runCLI();
}
