import * as path from "@std/path";
import { debounce } from "@std/async/debounce";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import type { SSEStreamingApi } from "hono/streaming";

import { Builder } from "./build.ts";
import { deno } from "./deno.ts";

export interface DevServerOptions {
  /**
   * The builder to use for the dev server.
   *
   * Defaults to a new builder using the default optionsc.
   */
  builder?: Builder;
  /**
   * The port to run the dev server on.
   *
   * Defaults to 9001.
   */
  port?: number;
}

interface RebuildRequest {
  server: boolean;
  client: boolean;
}

/**
 * Regular expression to match valid route files
 */
const VALID_ROUTE_FILE_REGEX =
  /^routes\/(?:(?!_)[^\/]+\/)*(?!_)[^\/]*(?<!\.test)\.tsx?$/;

/**
 * Regular expression to match files that should NOT trigger rebuilds
 */
const SHOULD_IGNORE_REGEX =
  /~|\.tmp$|\.lock$|\.log$|^(build|dev)\.ts$|^public\/build|\/\_|^\_|\.test\./;

export class DevServer {
  private watcher?: Deno.FsWatcher;
  private appProcess?: Deno.ChildProcess;
  private devServer?: { shutdown: () => void };
  readonly port: number;
  readonly builder: Builder;
  private queuedRebuild?: RebuildRequest;
  private stopping: boolean;
  private connectedClients: Set<SSEStreamingApi> = new Set();

  constructor(options?: DevServerOptions) {
    const { port, builder } = options ?? {};
    this.port = port ?? 9001;
    this.builder = builder ?? new Builder();
    this.stopping = false;
  }

  /**
   * Starts the dev server with file watching and app management
   */
  async start(): Promise<void> {
    console.log("🚀 Starting dev server...");

    await this.builder.build();

    queueMicrotask(async () => {
      this.startDevServer();
      await this.startApp();
    });

    this.watcher = deno.watchFs(this.builder.watchPaths);
    console.log(
      `👀 Watching for changes...`,
    );
    let events: Deno.FsEvent[] = [];
    const handleFileEvent = debounce(() => {
      this.handleFileEvents(events);
      events = [];
    }, 5);
    for await (const event of this.watcher) {
      events.push(event);
      handleFileEvent();
    }
  }

  /**
   * Starts the Hono dev server with SSE endpoint
   */
  private startDevServer(): void {
    const app = new Hono();

    app.use(
      "*",
      cors({
        origin: "*",
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
      }),
    );

    app.get("/sse", (c) => {
      return streamSSE(c, async (stream) => {
        this.connectedClients.add(stream);

        await stream.writeSSE({
          data: "connected",
          event: "dev-connection",
        });

        stream.onAbort(() => {
          this.connectedClients.delete(stream);
        });

        while (!this.stopping) {
          await stream.sleep(30000);
          await stream.writeSSE({
            data: "keepalive",
            event: "dev-keepalive",
          });
        }
      });
    });

    app.get("/health", (c) => {
      return c.json({ status: "ok", clients: this.connectedClients.size });
    });

    try {
      this.devServer = Deno.serve({ port: this.port }, app.fetch);
      console.log(`🌐 Dev server running at http://localhost:${this.port}`);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Address already in use")
      ) {
        console.log(
          `⚠️  Port ${this.port} already in use, dev server not started`,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Notifies all connected clients to reload
   */
  private async notifyClientsToReload(): Promise<void> {
    if (this.connectedClients.size === 0) return;

    console.log(
      `🔄 Notifying ${this.connectedClients.size} connected client(s) to reload...`,
    );

    const clientsToRemove: SSEStreamingApi[] = [];

    for (const client of this.connectedClients) {
      try {
        await client.writeSSE({
          data: JSON.stringify({ type: "reload", timestamp: Date.now() }),
          event: "dev-reload",
        });
      } catch {
        clientsToRemove.push(client);
      }
    }

    for (const client of clientsToRemove) {
      this.connectedClients.delete(client);
    }
  }

  /**
   * Stops the dev server and cleans up resources
   */
  async stop(): Promise<void> {
    console.log("🛑 Stopping dev server...");
    this.stopping = true;

    if (this.watcher) {
      try {
        this.watcher.close();
      } catch (error) {
        console.error(error);
      }
      delete this.watcher;
    }

    if (this.devServer) {
      this.devServer.shutdown();
      delete this.devServer;
    }

    if (this.appProcess) {
      console.log("🚨 Killing app process...");
      this.appProcess.kill("SIGTERM");
      await this.appProcess.status;
      delete this.appProcess;
    }

    await this.builder.dispose();
  }

  /**
   * Determines if a file is a valid route file
   */
  private isValidRouteFile(relativePath: string): boolean {
    return VALID_ROUTE_FILE_REGEX.test(relativePath);
  }

  /**
   * Determines if changes to a file should trigger a rebuild.
   * Default implementation excludes temporary, lock, log, and build files.
   */
  protected shouldTriggerRebuild(relativePath: string): boolean {
    return !SHOULD_IGNORE_REGEX.test(relativePath);
  }

  /**
   * Handles file system events
   */
  private handleFileEvents(events: Deno.FsEvent[]): void {
    const relativePaths = new Set(
      events
        .filter((e) => e.kind !== "access")
        .flatMap((e) =>
          e.paths.map((p) => path.relative(this.builder.projectRoot, p))
        )
        .filter((p) => this.shouldTriggerRebuild(p)),
    );

    if (relativePaths.size === 0) return;

    console.log(
      `📁 File change detected: ${Array.from(relativePaths).join(", ")}`,
    );

    const routeFilesChanged = Array.from(relativePaths)
      .filter((p) => this.isValidRouteFile(p));
    this.queuedRebuild = {
      server: this.queuedRebuild?.server ??
        routeFilesChanged.some((p) => p.endsWith(".ts")),
      client: this.queuedRebuild?.client ??
        routeFilesChanged.some((p) => p.endsWith(".tsx")),
    };
    this.checkRebuildQueue();
  }

  private async checkRebuildQueue(): Promise<void> {
    if (!this.builder.isBuilding && this.queuedRebuild) {
      const queuedRebuild = this.queuedRebuild;
      delete this.queuedRebuild;

      try {
        await this.builder.rebuild(queuedRebuild);
        if (!this.queuedRebuild) {
          await this.restartApp();
        }
      } catch (error) {
        console.error("🚨 Rebuild failed:", error);
      } finally {
        this.checkRebuildQueue();
      }
    }
  }

  /**
   * Starts the application in a child process
   */
  private async startApp(): Promise<void> {
    if (this.appProcess) {
      throw new Error("App already running");
    }
    console.log("🚀 Starting app...");

    const command = deno.command(Deno.execPath(), {
      args: ["task", "serve"],
      stdout: "piped",
      stderr: "piped",
    });

    this.appProcess = command.spawn();

    return await new Promise((resolve, reject) => {
      let resolved = false;
      this.appProcess!.status.then((status) => {
        if (!resolved) {
          resolved = true;
          if (status.code === 0) {
            resolve();
          } else {
            reject(new Error("App exited with code " + status.code));
          }
        }
        if (!this.stopping) {
          console.log("🚨 App exited with code", status.code);
          delete this.appProcess;
        }
      });
      const decoder = new TextDecoder();

      const stdoutReader = this.appProcess!.stdout.getReader();
      (async () => {
        try {
          while (true) {
            const { done, value } = await stdoutReader.read();
            if (done) break;

            const text = decoder.decode(value);
            if (!resolved && text.startsWith("Listening on")) {
              resolved = true;
              resolve();
            }
            await Deno.stdout.write(value);
          }
        } catch (error) {
          if ((error as Error).name !== "Interrupted") {
            console.error("Error reading stdout:", error);
          }
        }
      })();

      const stderrReader = this.appProcess!.stderr.getReader();
      (async () => {
        try {
          while (true) {
            const { done, value } = await stderrReader.read();
            if (done) break;

            const text = decoder.decode(value);
            if (!resolved && text.startsWith("Listening on")) {
              resolved = true;
              resolve();
            }
            await Deno.stderr.write(value);
          }
        } catch (error) {
          if ((error as Error).name !== "Interrupted") {
            console.error("Error reading stderr:", error);
          }
        }
      })();
    });
  }

  /**
   * Restarts the application
   */
  private async restartApp(): Promise<void> {
    console.log("🔄 Restarting application...");

    if (this.appProcess) {
      this.appProcess.kill("SIGTERM");
      await this.appProcess.status;
      this.appProcess = undefined;
    }

    await this.startApp();
    await this.notifyClientsToReload();
  }
}
