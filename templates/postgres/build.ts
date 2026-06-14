import * as path from "@std/path";

import { Builder } from "@udibo/juniper/build";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  // ./docker holds root-owned Postgres bind-mounts that crash Deno.watchFs.
  ignorePaths: ["./docker"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
