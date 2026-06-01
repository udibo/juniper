import * as path from "@std/path";

import { Builder } from "@udibo/juniper/build";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  // The Postgres container bind-mounts its data into ./docker/volumes as
  // root, which the dev server's file watcher cannot read. Ignoring ./docker
  // keeps `Deno.watchFs` from descending into it and crashing on startup.
  ignorePaths: ["./docker"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
