import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { resolve } from "@std/path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "./fork/client-stdio.ts";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { isSnapshotMode } from "@udibo/juniper/utils/testing";

// Strip timing information from test output and "Check file" lines
function stripTimings(text: string): string {
  const lines = text.split("\n");
  const filteredLines = lines.filter((line) => !line.startsWith("Check file"));
  return filteredLines.join("\n").replace(/\(\d+m?s\)/g, "(0ms)");
}

describe("MCP Server", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "deno",
      args: [
        "run",
        "-A",
        "--env-file",
        "--env-file=.env.test",
        "./mcp/server.ts",
      ],
    });

    client = new Client(
      {
        name: "example-client",
        version: "1.0.0",
      },
    );
    await client.connect(transport);
  });

  afterAll(async () => {
    await Promise.all([
      new Promise<void>((resolve) => {
        client.onclose = () => resolve();
        client.close();
      }),
      new Promise<void>((resolve) => {
        transport.onclose = () => resolve();
        transport.close();
      }),
    ]);
  });

  it("should be able to connect to the server", async () => {
    const tools = await client.listTools();
    assertEquals(tools.tools.length, 2);
    assertEquals(tools.tools.find((t) => t.name === "test")?.inputSchema, {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        file: {
          description:
            "The test file or directory to run tests for. If not provided, all tests will be run.",
          type: "string",
        },
        doc: {
          description:
            "Run tests for examples in docstrings or markdown files.",
          type: "boolean",
          default: false,
        },
        update: {
          description: "Whether to update snapshot files.",
          type: "boolean",
          default: false,
        },
      },
      additionalProperties: false,
    });
    assertEquals(tools.tools.find((t) => t.name === "coverage")?.inputSchema, {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  });

  it("should run tests on example.test.ts", async () => {
    const result = await client.callTool({
      name: "test",
      arguments: { file: "mcp/example.test.ts" },
    });
    const content = result.content as TextContent[];
    const snapshotPath = resolve(
      import.meta.dirname!,
      "./snapshots/test-tool.txt",
    );
    if (isSnapshotMode()) {
      await Deno.writeTextFile(snapshotPath, stripTimings(content[0].text));
    }
    assertEquals(content[0].type, "text");
    assertEquals(
      stripTimings(content[0].text),
      await Deno.readTextFile(snapshotPath),
    );
    assertEquals(result.isError, false);
  });

  it("should run tests with --doc flag", async () => {
    const result = await client.callTool({
      name: "test",
      arguments: { doc: true, file: "mcp/example.test.ts" },
    });
    const content = result.content as TextContent[];
    assertEquals(content[0].type, "text");
    assertEquals(result.isError, false);
  });

  it("should run coverage tool", async () => {
    const result = await client.callTool({
      name: "coverage",
      arguments: {},
    });
    const content = result.content as TextContent[];
    assertEquals(content[0].type, "text");
    // Does not assert anything about the output because it's not stable.
    // Content will change depending on if all tests have run since the last change was made.
  });
});
