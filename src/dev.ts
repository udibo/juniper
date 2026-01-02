import { parseArgs } from "@std/cli/parse-args";
import * as path from "@std/path";

import { Builder } from "./build.ts";

import { DevServer } from "./_dev.ts";

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["project-root", "port"],
  });
  const projectRoot = path.resolve(Deno.cwd(), args["project-root"] ?? ".");
  const port = args.port ? Number(args.port) : undefined;
  let builder: Builder | undefined;
  try {
    builder = (await import(projectRoot + "/build.ts")).builder;
  } catch (error) {
    if (
      !(error instanceof TypeError &&
        (error as TypeError & { code?: string }).code ===
          "ERR_MODULE_NOT_FOUND")
    ) {
      console.error("❌ Error importing build.ts:", error);
    }
  }

  if (!builder) {
    console.log("🔨 No build.ts file found, using default builder...");
    builder = new Builder({ projectRoot });
  }

  const devServer = new DevServer({ builder, port });

  let shuttingDown = false;
  const handleShutdown = async () => {
    if (!shuttingDown) {
      shuttingDown = true;
      await devServer.stop();
      Deno.exit(0);
    }
  };

  Deno.addSignalListener("SIGINT", handleShutdown);
  Deno.addSignalListener("SIGTERM", handleShutdown);

  try {
    await devServer.start();
  } catch (error) {
    console.error("❌ Dev server error:", error);
    await devServer.stop();
    Deno.exit(1);
  }
}
