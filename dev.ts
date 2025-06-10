import { parseArgs } from "@std/cli/parse-args";

import { Builder } from "./build.ts";
import { DevServer } from "./_dev.ts";

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["project-root", "port"],
  });
  const projectRoot = args["project-root"] ?? Deno.cwd();
  const port = args.port ? Number(args.port) : undefined;
  let builder: Builder;
  try {
    builder = (await import(projectRoot + "/build.ts")).builder;
  } catch {
    console.log("🔨 No build.ts file found, using default builder...");
  }
  builder ??= new Builder({ projectRoot });

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
