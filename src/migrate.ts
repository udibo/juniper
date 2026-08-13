/**
 * This module provides a CLI tool for migrating React Router applications to Juniper.
 *
 * It detects existing React Router routes and middleware, presents findings for
 * user confirmation, and generates Juniper-compatible route files.
 *
 * @module
 */

import { parseArgs } from "@std/cli/parse-args";
import * as path from "@std/path";
import { exists } from "@std/fs/exists";
import { confirm } from "@std/cli/confirm";
import { Select } from "@std/cli/unstable-select";

import {
  detectReactRouterRoutes,
  type DetectedRoute,
} from "./_migrate.ts";
import { generateJuniperRoutes } from "./_migrate.ts";

const HELP_TEXT = `
Juniper Migrate - Detect and adapt React Router apps to Juniper

USAGE:
  deno run -A @udibo/juniper/migrate [OPTIONS] <source>

OPTIONS:
  --source <path>     Source directory to scan (default: current directory)
  --target <path>     Target directory for Juniper routes (default: ./routes)
  --dry-run           Preview changes without writing files
  --yes, -y           Skip confirmation prompts
  --help, -h          Show this help message

EXAMPLES:
  # Scan current directory and generate routes
  deno run -A @udibo/juniper/migrate

  # Scan specific directory
  deno run -A @udibo/juniper/migrate --source ./my-react-app

  # Preview without writing
  deno run -A @udibo/juniper/migrate --dry-run

  # Skip confirmations
  deno run -A @udibo/juniper/migrate --yes
`;

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["source", "target"],
    boolean: ["dry-run", "yes", "help"],
    alias: {
      h: "help",
      y: "yes",
    },
    default: {
      source: ".",
      target: "./routes",
      "dry-run": false,
      yes: false,
    },
  });

  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  const sourceDir = path.resolve(Deno.cwd(), args.source as string);
  const targetDir = path.resolve(Deno.cwd(), args.target as string);
  const dryRun = args["dry-run"] as boolean;
  const skipConfirm = args.yes as boolean;

  console.log("🔍 Juniper Migrate");
  console.log(`   Source: ${sourceDir}`);
  console.log(`   Target: ${targetDir}`);
  console.log("");

  // Check if source exists
  if (!(await exists(sourceDir))) {
    console.error(`❌ Source directory does not exist: ${sourceDir}`);
    Deno.exit(1);
  }

  try {
    // Detect React Router routes
    console.log("📡 Scanning for React Router routes...");
    const detected = await detectReactRouterRoutes(sourceDir);
    
    if (detected.routes.length === 0) {
      console.log("⚠️  No React Router routes detected.");
      console.log("   Make sure your app uses createBrowserRouter, createMemoryRouter, etc.");
      Deno.exit(0);
    }

    // Display findings
    console.log(`\n✅ Found ${detected.routes.length} routes:`);
    console.log("");
    
    for (const route of detected.routes) {
      console.log(`   📁 ${route.path || "/"}`);
      if (route.component) {
        console.log(`      Component: ${route.component}`);
      }
      if (route.loader) {
        console.log(`      Loader: ${route.loader}`);
      }
      if (route.action) {
        console.log(`      Action: ${route.action}`);
      }
      if (route.middleware && route.middleware.length > 0) {
        console.log(`      Middleware: ${route.middleware.join(", ")}`);
      }
      if (route.children && route.children.length > 0) {
        console.log(`      Children: ${route.children.length} routes`);
      }
      console.log("");
    }

    if (detected.middleware.length > 0) {
      console.log(`🔧 Found ${detected.middleware.length} middleware definitions:`);
      for (const mw of detected.middleware) {
        console.log(`   - ${mw.name} (${mw.file})`);
      }
      console.log("");
    }

    // Show warnings
    if (detected.warnings.length > 0) {
      console.log("⚠️  Warnings:");
      for (const warning of detected.warnings) {
        console.log(`   - ${warning}`);
      }
      console.log("");
    }

    // Confirm before proceeding
    if (!skipConfirm && !dryRun) {
      const proceed = await confirm({
        message: "Generate Juniper routes from detected configuration?",
      });
      
      if (!proceed) {
        console.log("❌ Migration cancelled.");
        Deno.exit(0);
      }
    }

    if (dryRun) {
      console.log("🔍 Dry run mode - no files will be written");
      console.log("");
    }

    // Generate Juniper routes
    console.log("🏗️  Generating Juniper routes...");
    const result = await generateJuniperRoutes(detected, targetDir, {
      dryRun,
    });

    console.log("");
    console.log("✅ Generation complete!");
    console.log(`   Files created: ${result.filesCreated.length}`);
    console.log(`   Files skipped: ${result.filesSkipped.length}`);
    
    if (result.filesCreated.length > 0) {
      console.log("");
      console.log("📁 Created files:");
      for (const file of result.filesCreated) {
        console.log(`   - ${path.relative(Deno.cwd(), file)}`);
      }
    }

    if (!dryRun) {
      console.log("");
      console.log("🎉 Next steps:");
      console.log("   1. Review the generated routes in", targetDir);
      console.log("   2. Run 'deno task dev' to start the dev server");
      console.log("   3. Update your build.ts to use the Juniper Builder");
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    Deno.exit(1);
  }
}
