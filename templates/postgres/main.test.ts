import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { resolve } from "@std/path/resolve";
import { mergeReadableStreams, TextLineStream } from "@std/streams";
import { describe, it } from "@std/testing/bdd";

import { server } from "./main.ts";

describe("serves static files", () => {
  it("should serve a static file", async () => {
    const res = await server.request("http://localhost/favicon.ico");

    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "image/x-icon");
    assertEquals(
      new Uint8Array(await res.arrayBuffer()).length,
      (await Deno.readFile(
        resolve(import.meta.dirname!, "./public/favicon.ico"),
      )).length,
      "Length of served file",
    );
  });
});

describe("serves application when running main.ts", () => {
  it("should serve the application", async () => {
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        `--env-file=${resolve(import.meta.dirname!, "./.env")}`,
        `--env-file=${resolve(import.meta.dirname!, "./.env.test")}`,
        resolve(import.meta.dirname!, "./main.ts"),
      ],
      env: { DENO_SERVE_ADDRESS: "tcp:127.0.0.1:0" },
      stdout: "piped",
      stderr: "piped",
    });
    await using child = command.spawn();
    const stdout = mergeReadableStreams(child.stdout, child.stderr)
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());

    let url = "";
    for await (const line of stdout.values({ preventCancel: true })) {
      if (line.includes("Listening on ")) {
        url = line.split("Listening on ")[1].split(" ")[0];
        break;
      }
    }
    assert(url, "server did not report its address");

    const res = await fetch(url);
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "PostgreSQL Example");
  });
});
