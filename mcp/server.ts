import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// Patch from this PR:
// https://github.com/modelcontextprotocol/typescript-sdk/pull/349
import { StdioServerTransport } from "./fork/server-stdio.ts";
import { z } from "zod";

console.log("Starting MCP server");
export const server = new McpServer({
  name: "Juniper",
  version: "0.0.1",
  capabilities: {
    tools: {},
  },
});

// Echo tool for testing MCP responses
server.tool(
  "echo",
  { message: z.string() },
  ({ message }) => {
    return {
      content: [{
        type: "text",
        text: `Echo response: ${message}`,
      }],
    };
  },
);

server.tool(
  "test",
  { file: z.string().optional() },
  async ({ file }) => {
    try {
      const denoPath = Deno.execPath();
      const args = [
        "task",
        "test",
      ];
      if (file) args.push(file);

      const command = new Deno.Command(denoPath, {
        args,
        stdout: "piped",
        stderr: "piped",
        cwd: "/home/kyle/Projects/deno/juniper",
      });

      const { code, stdout, stderr } = await command.output();
      const output = new TextDecoder().decode(stdout);
      const errors = new TextDecoder().decode(stderr);

      return {
        content: [{
          type: "text",
          text: output + (errors ?? ""),
        }],
        isError: code !== 0,
      };
    } catch (error: unknown) {
      return {
        content: [{
          type: "text",
          text: `Error running tests: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }],
        isError: true,
      };
    }
  },
);

if (import.meta.main) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
