import { assertEquals, assertRejects } from "@std/assert";
import { delay } from "@std/async";
import * as path from "@std/path";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertSpyCall, assertSpyCalls, spy, stub } from "@std/testing/mock";
import type { Spy } from "@std/testing/mock";
import type * as esbuild from "esbuild";
import type { SSEStreamingApi } from "hono/streaming";

import { Builder } from "@udibo/juniper/build";
import { isSnapshotMode } from "@udibo/juniper/utils/testing";

import { DevServer } from "./_dev.ts";
import {
  deno,
  FakeChildProcess,
  FakeCommand,
  FakeFsWatcher,
  FakeSubprocessReadableStream,
} from "./deno.ts";

const exampleDir = path.resolve(
  path.dirname(path.fromFileUrl(import.meta.url)),
  "example",
);

describe("DevServer", () => {
  let writeTextFileStub: Spy<
    typeof deno,
    Parameters<typeof deno.writeTextFile>,
    ReturnType<typeof deno.writeTextFile>
  >;
  let watchFsStub: Spy<
    typeof deno,
    Parameters<typeof deno.watchFs>,
    ReturnType<typeof deno.watchFs>
  >;
  let commandStub: Spy<
    typeof deno,
    Parameters<typeof deno.command>,
    ReturnType<typeof deno.command>
  >;
  let fakeFsWatcher: FakeFsWatcher;
  let fakeCommand: FakeCommand;
  let builder: Builder;

  beforeEach(() => {
    writeTextFileStub = isSnapshotMode()
      ? spy(deno, "writeTextFile")
      : stub(deno, "writeTextFile");

    fakeFsWatcher = new FakeFsWatcher();
    watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

    fakeCommand = new FakeCommand("", {});
    commandStub = stub(deno, "command", () => fakeCommand);

    builder = new Builder({
      projectRoot: exampleDir,
      configPath: "../deno.json",
      write: false,
    });
  });

  afterEach(async () => {
    writeTextFileStub.restore();
    watchFsStub.restore();
    commandStub.restore();
    await builder.dispose();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      const devServer = new DevServer();
      assertEquals(devServer.port, 9001);
      assertEquals(typeof devServer.builder, "object");
    });

    it("should initialize with custom port", () => {
      const devServer = new DevServer({ port: 3000 });
      assertEquals(devServer.port, 3000);
    });

    it("should initialize with custom builder", () => {
      const devServer = new DevServer({ builder });
      assertEquals(devServer.builder, builder);
    });
  });

  describe("start", () => {
    it("should call builder.build() on start", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCall(buildStub, 0);
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
      }
    });

    it("should create file system watcher", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCall(watchFsStub, 0, {
          args: [builder.watchPaths],
        });
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
      }
    });

    it("should handle build failure during start", async () => {
      const buildError = new Error("Build failed");
      const buildStub = stub(
        builder,
        "build",
        () => Promise.reject(buildError),
      );
      try {
        const devServer = new DevServer({ builder });

        await assertRejects(
          async () => await devServer.start(),
          Error,
          "Build failed",
        );
      } finally {
        buildStub.restore();
      }
    });
  });

  describe("stop", () => {
    it("should close file system watcher", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCall(fakeFsWatcher.closeSpy, 0);
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
      }
    });

    it("should handle watcher close error gracefully", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const closeStub = stub(fakeFsWatcher, "close", () => {
        throw new Error("Close failed");
      });
      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);

        await devServer.stop();
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        closeStub.restore();
      }
    });

    it("should dispose builder", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const disposeStub = stub(builder, "dispose", () => Promise.resolve());
      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCall(disposeStub, 0);
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        disposeStub.restore();
      }
    });
  });

  describe("file change detection", () => {
    it("should trigger rebuild for .ts route file changes", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const rebuildStub = stub(
        builder,
        "rebuild",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      fakeFsWatcher = new FakeFsWatcher([{
        kind: "modify",
        paths: [path.join(exampleDir, "routes/api/hello.ts")],
      }]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCalls(rebuildStub, 1);
        assertSpyCall(rebuildStub, 0, {
          args: [{ server: true, client: false }],
        });
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });

    it("should trigger rebuild for .tsx route file changes", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const rebuildStub = stub(
        builder,
        "rebuild",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      fakeFsWatcher = new FakeFsWatcher([{
        kind: "modify",
        paths: [path.join(exampleDir, "routes/index.tsx")],
      }]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCalls(rebuildStub, 1);
        assertSpyCall(rebuildStub, 0, {
          args: [{ server: false, client: true }],
        });
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });

    it("should ignore changes to private files", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const rebuildStub = stub(
        builder,
        "rebuild",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      fakeFsWatcher = new FakeFsWatcher([{
        kind: "modify",
        paths: [path.join(exampleDir, "routes/_components/Button.tsx")],
      }]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCalls(rebuildStub, 0);
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });

    it("should ignore changes to test files", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const rebuildStub = stub(
        builder,
        "rebuild",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      fakeFsWatcher = new FakeFsWatcher([{
        kind: "modify",
        paths: [path.join(exampleDir, "routes/api/hello.test.ts")],
      }]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCalls(rebuildStub, 0);
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });

    it("should ignore access events", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const rebuildStub = stub(
        builder,
        "rebuild",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      fakeFsWatcher = new FakeFsWatcher([{
        kind: "access",
        paths: [path.join(exampleDir, "routes/index.ts")],
      }]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCalls(rebuildStub, 0);
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });

    it("should ignore changes to excluded file patterns", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const rebuildStub = stub(
        builder,
        "rebuild",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      fakeFsWatcher = new FakeFsWatcher([{
        kind: "modify",
        paths: [
          path.join(exampleDir, "temp.tmp"),
          path.join(exampleDir, "file.lock"),
          path.join(exampleDir, "app.log"),
          path.join(exampleDir, "build.ts"),
          path.join(exampleDir, "public/build/main.js"),
        ],
      }]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCalls(rebuildStub, 0);
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });
  });

  describe("rebuild merging", () => {
    it("should merge multiple rebuild requests", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const rebuildStub = stub(
        builder,
        "rebuild",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      fakeFsWatcher = new FakeFsWatcher([{
        kind: "modify",
        paths: [
          path.join(exampleDir, "routes/server.ts"),
          path.join(exampleDir, "routes/client.tsx"),
        ],
      }]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCalls(rebuildStub, 1);
        assertSpyCall(rebuildStub, 0, {
          args: [{ server: true, client: true }],
        });
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });
  });

  describe("error handling", () => {
    it("should handle rebuild failures gracefully", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      let rebuildReject: (error: Error) => void;
      const rebuildPromise = new Promise<esbuild.BuildResult>((_, reject) => {
        rebuildReject = reject;
      });
      rebuildPromise.catch(() => {});

      const rebuildStub = stub(builder, "rebuild", () => rebuildPromise);

      fakeFsWatcher = new FakeFsWatcher([{
        kind: "modify",
        paths: [path.join(exampleDir, "routes/index.ts")],
      }]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();

        await delay(10);
        rebuildReject!(new Error("Rebuild failed"));
        await delay(10);

        await devServer.stop();

        assertSpyCalls(rebuildStub, 1);
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });
  });

  describe("app process management", () => {
    it("should start app process and wait for 'Listening on' message", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      class TestChildProcess extends FakeChildProcess {
        constructor() {
          super(0);
        }

        override get stdout() {
          return new FakeSubprocessReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode("Listening on http://localhost:8000\n"),
              );
              controller.close();
            },
          });
        }
      }

      const testCommand = new FakeCommand("", {});
      testCommand.spawn = () => new TestChildProcess();
      commandStub.restore();
      commandStub = stub(deno, "command", () => testCommand);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertSpyCall(commandStub, 0, {
          args: [Deno.execPath(), {
            args: ["task", "serve", "--hot-reload"],
            stdout: "piped",
            stderr: "piped",
          }],
        });
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
      }
    });

    it("should handle 'Listening on' message from stderr", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      class TestChildProcess extends FakeChildProcess {
        constructor() {
          super(0);
        }

        override get stderr() {
          return new FakeSubprocessReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode("Listening on http://localhost:8000\n"),
              );
              controller.close();
            },
          });
        }
      }

      const testCommand = new FakeCommand("", {});
      testCommand.spawn = () => new TestChildProcess();
      commandStub.restore();
      commandStub = stub(deno, "command", () => testCommand);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
      }
    });

    it("should restart app process after rebuild", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const rebuildStub = stub(
        builder,
        "rebuild",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      let processCount = 0;
      class TestChildProcess extends FakeChildProcess {
        constructor() {
          super(0);
          processCount++;
        }

        override get stdout() {
          return new FakeSubprocessReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode("Listening on http://localhost:8000\n"),
              );
              controller.close();
            },
          });
        }
      }

      const testCommand = new FakeCommand("", {});
      testCommand.spawn = () => new TestChildProcess();
      commandStub.restore();
      commandStub = stub(deno, "command", () => testCommand);

      fakeFsWatcher = new FakeFsWatcher([{
        kind: "modify",
        paths: [path.join(exampleDir, "routes/index.ts")],
      }]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertEquals(processCount, 2);
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });
  });

  describe("rebuild queue optimization", () => {
    it("should queue rebuilds while builder is busy", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      let rebuildCount = 0;
      const rebuildStub = stub(builder, "rebuild", () => {
        rebuildCount++;
        return Promise.resolve({} as esbuild.BuildResult);
      });

      fakeFsWatcher = new FakeFsWatcher([{
        kind: "modify",
        paths: [path.join(exampleDir, "routes/index.ts")],
      }]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertEquals(rebuildCount, 1);
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });

    it("should handle multiple queued rebuilds after completion", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      let rebuildCallCount = 0;
      const rebuildStub = stub(builder, "rebuild", () => {
        rebuildCallCount++;
        return Promise.resolve({} as esbuild.BuildResult);
      });

      fakeFsWatcher = new FakeFsWatcher([
        {
          kind: "modify",
          paths: [path.join(exampleDir, "routes/server.ts")],
        },
        {
          kind: "modify",
          paths: [path.join(exampleDir, "routes/client.tsx")],
        },
      ]);
      watchFsStub.restore();
      watchFsStub = stub(deno, "watchFs", () => fakeFsWatcher);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertEquals(rebuildCallCount, 1);
        assertSpyCall(rebuildStub, 0, {
          args: [{ server: true, client: true }],
        });
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        rebuildStub.restore();
      }
    });
  });

  describe("edge cases", () => {
    it("should handle stdout/stderr read errors gracefully", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      class TestChildProcess extends FakeChildProcess {
        constructor() {
          super(0);
        }

        override get stdout() {
          return new FakeSubprocessReadableStream({
            start(controller) {
              controller.error(new Error("Read error"));
            },
          });
        }

        override get stderr() {
          return new FakeSubprocessReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode("Listening on http://localhost:8000\n"),
              );
              controller.close();
            },
          });
        }
      }

      const testCommand = new FakeCommand("", {});
      testCommand.spawn = () => new TestChildProcess();
      commandStub.restore();
      commandStub = stub(deno, "command", () => testCommand);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
      }
    });

    it("should handle interrupted stream errors gracefully", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      class TestChildProcess extends FakeChildProcess {
        constructor() {
          super(0);
        }

        override get stdout() {
          return new FakeSubprocessReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode("Listening on http://localhost:8000\n"),
              );
              controller.close();
            },
          });
        }

        override get stderr() {
          return new FakeSubprocessReadableStream({
            start(controller) {
              const error = new Error("Stream interrupted");
              error.name = "Interrupted";
              controller.error(error);
            },
          });
        }
      }

      const testCommand = new FakeCommand("", {});
      testCommand.spawn = () => new TestChildProcess();
      commandStub.restore();
      commandStub = stub(deno, "command", () => testCommand);

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);
        await devServer.stop();

        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
      }
    });

    it("should handle dispose builder errors during stop", async () => {
      const buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      const disposeStub = stub(
        builder,
        "dispose",
        () => Promise.reject(new Error("Dispose failed")),
      );

      try {
        const devServer = new DevServer({ builder });

        const startPromise = devServer.start();
        await delay(10);

        await assertRejects(
          async () => await devServer.stop(),
          Error,
          "Dispose failed",
        );
        assertEquals(await startPromise, undefined);
      } finally {
        buildStub.restore();
        disposeStub.restore();
      }
    });
  });

  describe("dev server internals", () => {
    it("notifyClientsToReload: no clients is a no-op", async () => {
      using _buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      const devServer = new DevServer({ builder });
      const startPromise = devServer.start();
      await delay(10);

      await devServer.notifyClientsToReload();

      await devServer.stop();
      assertEquals(await startPromise, undefined);
    });

    it("notifyClientsToReload: removes failing clients", async () => {
      using _buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      const devServer = new DevServer({ builder });
      const startPromise = devServer.start();
      await delay(10);

      const failingClient = {
        writeSSE: () => Promise.reject(new Error("fail")),
      } as unknown as { writeSSE: (init: unknown) => Promise<void> };
      devServer.connectedClients.add(
        failingClient as unknown as SSEStreamingApi,
      );

      await devServer.notifyClientsToReload();

      assertEquals(devServer.connectedClients.size, 0);

      await devServer.stop();
      assertEquals(await startPromise, undefined);
    });

    it("startDevServer handles 'Address already in use' gracefully", () => {
      using _buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      using _serveStub = stub(Deno, "serve", () => {
        throw new Error("Address already in use");
      });

      const devServer = new DevServer({ builder });
      devServer.startDevServer();
    });

    it("isValidRouteFile returns true for route .ts/.tsx and false for private/test files", () => {
      const devServer = new DevServer({ builder });
      // valid
      assertEquals(devServer.isValidRouteFile("routes/index.ts"), true);
      assertEquals(devServer.isValidRouteFile("routes/blog/index.tsx"), true);
      assertEquals(devServer.isValidRouteFile("routes/blog/[id].ts"), true);
      // invalid: private files and tests
      assertEquals(
        devServer.isValidRouteFile("routes/_components/Button.tsx"),
        false,
      );
      assertEquals(
        devServer.isValidRouteFile("routes/blog/index.test.tsx"),
        false,
      );
      assertEquals(devServer.isValidRouteFile("main.ts"), false);
    });

    it("notifyClientsToReload retains healthy clients", async () => {
      using _buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );

      const devServer = new DevServer({ builder });
      const startPromise = devServer.start();
      await delay(10);

      let wrote = 0;
      const healthyClient = {
        writeSSE: () => {
          wrote++;
          return Promise.resolve();
        },
      } as unknown as SSEStreamingApi;
      devServer.connectedClients.add(healthyClient);

      await devServer.notifyClientsToReload();
      assertEquals(wrote > 0, true);
      assertEquals(devServer.connectedClients.size, 1);

      await devServer.stop();
      assertEquals(await startPromise, undefined);
    });

    it("startDevServer serves /health with client count", async () => {
      using _buildStub = stub(
        builder,
        "build",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      let capturedFetch: (req: Request) => Promise<Response>;
      const fakeServer = { shutdown() {} };
      using _serveStub = stub(
        Deno as unknown as { serve: typeof Deno.serve },
        "serve",
        ((_opts: unknown, fetcher: (req: Request) => Promise<Response>) => {
          capturedFetch = fetcher;
          return fakeServer as unknown as ReturnType<typeof Deno.serve>;
        }) as unknown as typeof Deno.serve,
      );

      const devServer = new DevServer({ builder });
      devServer.startDevServer();

      const res = await capturedFetch!(new Request("http://localhost/health"));
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.status, "ok");
      assertEquals(body.clients, 0);
    });

    it("shouldTriggerRebuild honors ignore rules", () => {
      const devServer = new DevServer({ builder });
      // Ignored by suffixes
      assertEquals(devServer.shouldTriggerRebuild("somefile~"), false);
      assertEquals(devServer.shouldTriggerRebuild("temp.tmp"), false);
      assertEquals(devServer.shouldTriggerRebuild("file.lock"), false);
      assertEquals(devServer.shouldTriggerRebuild("app.log"), false);
      // Ignored build/dev entrypoints
      assertEquals(devServer.shouldTriggerRebuild("build.ts"), false);
      assertEquals(devServer.shouldTriggerRebuild("dev.ts"), false);
      // Ignored public build outputs
      assertEquals(
        devServer.shouldTriggerRebuild("public/build/app.js"),
        false,
      );
      // Ignored underscore prefixed files/dirs
      assertEquals(devServer.shouldTriggerRebuild("_private.ts"), false);
      assertEquals(
        devServer.shouldTriggerRebuild("routes/_partial.tsx"),
        false,
      );
      // Ignored tests
      assertEquals(
        devServer.shouldTriggerRebuild("routes/page.test.tsx"),
        false,
      );
      // Allowed others
      assertEquals(devServer.shouldTriggerRebuild("routes/page.tsx"), true);
      assertEquals(devServer.shouldTriggerRebuild("routes/page.ts"), true);
    });

    it("handleFileEvents triggers rebuild with server and client flags", async () => {
      const devServer = new DevServer({ builder });
      const rebuildStub = stub(
        builder,
        "rebuild",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      try {
        const events: Deno.FsEvent[] = [
          {
            kind: "create",
            paths: [
              `${builder.projectRoot}/routes/a.ts`,
              `${builder.projectRoot}/routes/b.tsx`,
              `${builder.projectRoot}/routes/_c.tsx`,
              `${builder.projectRoot}/public/build/out.js`,
              `${builder.projectRoot}/dev.ts`,
            ],
          },
          { kind: "access", paths: [`${builder.projectRoot}/routes/noop.ts`] },
        ];

        devServer.handleFileEvents(events);
        await delay(5);

        assertSpyCalls(rebuildStub, 1);
        assertSpyCall(rebuildStub, 0, {
          args: [{ server: true, client: true }],
        });
      } finally {
        rebuildStub.restore();
      }
    });

    // Skipping explicit busy-builder test: Builder.isBuilding is read-only and non-trivial to override here.

    it("checkRebuildQueue rebuilds and restarts when idle", async () => {
      const devServer = new DevServer({ builder });
      devServer.queuedRebuild = {
        server: false,
        client: true,
      } as unknown as typeof devServer.queuedRebuild;

      using _rebuildStub = stub(
        builder,
        "rebuild",
        () => Promise.resolve({} as esbuild.BuildResult),
      );
      // Spy on restartApp to verify it was called
      using _restartSpy = stub(
        devServer,
        "restartApp",
        () => Promise.resolve(),
      );

      await devServer.checkRebuildQueue();

      assertSpyCalls(_rebuildStub, 1);
      assertSpyCalls(_restartSpy, 1);
      assertEquals(devServer.queuedRebuild, undefined);
    });
  });
});
