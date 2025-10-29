import { assertEquals, assertRejects } from "@std/assert";
import { delay } from "@std/async";
import * as path from "@std/path";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { assertSpyCall, assertSpyCalls, spy, stub } from "@std/testing/mock";
import type { Spy } from "@std/testing/mock";
import type * as esbuild from "esbuild";

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
            args: ["task", "serve"],
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
});
