import { Builder } from "@udibo/juniper/build";
import * as path from "@std/path";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "../deno.json",
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
