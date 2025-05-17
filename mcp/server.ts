import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// Patch from this PR:
// https://github.com/modelcontextprotocol/typescript-sdk/pull/349
import { StdioServerTransport } from "./fork/server-stdio.ts";
import { z } from "zod";
import * as path from "@std/path";
import { isTest } from "@udibo/juniper/utils/env";

const cwd = path.resolve(path.fromFileUrl(import.meta.url), "../../");

export const server = new McpServer({
  name: "Juniper",
  version: "0.0.1",
  capabilities: {
    tools: {},
  },
});

server.tool(
  "test",
  {
    file: z.string().optional().describe(
      "The test file or directory to run tests for. If not provided, all tests will be run.",
    ),
    doc: z.boolean().optional().default(false).describe(
      "Run tests for examples in docstrings or markdown files.",
    ),
    update: z.boolean().optional().default(false).describe(
      "Whether to update snapshot files.",
    ),
  },
  async ({ file, doc, update }) => {
    try {
      const denoPath = Deno.execPath();
      const args = [
        "task",
        "test",
      ];

      if (!isTest()) args.push("--coverage");
      if (doc) args.push("--doc");
      if (file) args.push(file);

      if (update) {
        args.push("--");
        args.push("--update");
      }

      const command = new Deno.Command(denoPath, {
        args,
        env: { "NO_COLOR": "1" },
        stdout: "piped",
        stderr: "piped",
        cwd,
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

server.tool(
  "coverage",
  {},
  async () => {
    try {
      const denoPath = Deno.execPath();
      const command = new Deno.Command(denoPath, {
        args: ["coverage", "--detailed"],
        env: { "NO_COLOR": "1" },
        stdout: "piped",
        stderr: "piped",
        cwd,
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
          text: `Error running coverage: ${
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
