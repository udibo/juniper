import * as path from "@std/path";

import { Builder } from "@udibo/juniper/build";
import { postCSSPlugin } from "@udibo/esbuild-plugin-postcss";
import tailwindcss from "@tailwindcss/postcss";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  plugins: [
    postCSSPlugin({
      plugins: [tailwindcss()],
    }),
  ],
  entryPoints: ["./main.css"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
