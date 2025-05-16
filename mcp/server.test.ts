import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { resolve } from "@std/path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "./fork/client-stdio.ts";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";

import { isSnapshotMode } from "../utils/testing.ts";

// Strip timing information from test output
function stripTimings(text: string): string {
  return text.replace(/\(\d+m?s\)/g, "(0ms)");
}

describe("MCP Server", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "deno",
      args: ["run", "-A", "./mcp/server.ts"],
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
          type: "string",
        },
      },
      additionalProperties: false,
    });
    assertEquals(tools.tools.find((t) => t.name === "echo")?.inputSchema, {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        message: {
          type: "string",
        },
      },
      additionalProperties: false,
      required: ["message"],
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
  });
});
