import { assertEquals, assertStringIncludes } from "@std/assert";
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
      stdout: "piped",
      stderr: "piped",
    });
    await using child = command.spawn();
    const stdout = mergeReadableStreams(child.stdout, child.stderr)
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream());

    for await (const line of stdout.values({ preventCancel: true })) {
      if (line.includes("Listening on")) {
        const address = Deno.build.os === "windows"
          ? "http://localhost:8100/"
          : "http://0.0.0.0:8100/ (http://localhost:8100/)";
        assertEquals(
          line,
          `Listening on ${address}`,
        );
        break;
      }
    }

    const res = await fetch("http://localhost:8100/");
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "Welcome to Juniper");
  });
});
