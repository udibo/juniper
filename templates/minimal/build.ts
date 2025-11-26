import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
console.log("projectRoot", projectRoot);
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
