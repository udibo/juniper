// deno-coverage-ignore-file

import { spy } from "@std/testing/mock";

export const deno = {
  writeTextFile(
    path: string | URL,
    data: string | ReadableStream<string>,
    options?: Deno.WriteFileOptions,
  ) {
    return Deno.writeTextFile(path, data, options);
  },
  watchFs(paths: string | string[], options?: { recursive: boolean }) {
    return Deno.watchFs(paths, options);
  },
  command(program: string | URL, options?: Deno.CommandOptions) {
    return new Deno.Command(program, options);
  },
};

/**
 * A fake implementation of Deno.FsWatcher for testing purposes.
 * Allows controlling file system events in tests.
 */
export class FakeFsWatcher implements Deno.FsWatcher {
  private events: Deno.FsEvent[] = [];
  private closeCallbacks: (() => void)[] = [];
  private _closed = false;
  public closeSpy = spy();

  constructor(events: Deno.FsEvent[] = []) {
    this.events = [...events];
  }

  close(): void {
    this.closeSpy();
    this._closed = true;
    this.closeCallbacks.forEach((callback) => callback());
  }

  [Symbol.dispose](): void {
    this.close();
  }

  return(value?: unknown): Promise<IteratorResult<Deno.FsEvent>> {
    this.close();
    return Promise.resolve({ done: true, value: value as Deno.FsEvent });
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<Deno.FsEvent> {
    for (const event of this.events) {
      if (this._closed) break;
      yield event;
    }
  }

  addEvent(event: Deno.FsEvent): void {
    this.events.push(event);
  }

  onClose(callback: () => void): void {
    this.closeCallbacks.push(callback);
  }

  get closed(): boolean {
    return this._closed;
  }
}

/**
 * A fake implementation of Deno.ChildProcess for testing purposes.
 */
export class FakeChildProcess implements Deno.ChildProcess {
  public killSpy = spy();
  private _status: Promise<Deno.CommandStatus>;

  constructor(exitCode: number = 0) {
    this._status = Promise.resolve({
      code: exitCode,
      signal: null,
      success: exitCode === 0,
    });
  }

  get pid() {
    return 12345;
  }

  get stdin() {
    return new WritableStream();
  }

  get stdout() {
    return new ReadableStream({
      start(controller) {
        // Immediately close the stream for testing
        controller.close();
      },
    });
  }

  get stderr() {
    return new ReadableStream({
      start(controller) {
        // Immediately close the stream for testing
        controller.close();
      },
    });
  }

  get status() {
    return this._status;
  }

  kill(signo?: Deno.Signal): void {
    this.killSpy(signo);
  }

  ref(): void {
    // No-op for testing
  }

  unref(): void {
    // No-op for testing
  }

  output(): Promise<Deno.CommandOutput> {
    return Promise.resolve({
      code: 0,
      signal: null,
      success: true,
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
    });
  }

  [Symbol.dispose](): void {
    this.kill();
  }

  [Symbol.asyncDispose](): Promise<void> {
    this.kill();
    return Promise.resolve();
  }
}

/**
 * A fake implementation of Deno.Command for testing purposes.
 */
export class FakeCommand {
  public spawnSpy = spy();

  constructor(
    private program: string | URL,
    private options?: Deno.CommandOptions,
  ) {}

  spawn(): FakeChildProcess {
    const process = new FakeChildProcess();
    this.spawnSpy(this.program, this.options);
    return process;
  }

  output(): Promise<Deno.CommandOutput> {
    return Promise.resolve({
      code: 0,
      signal: null,
      success: true,
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
    });
  }

  outputSync(): Deno.CommandOutput {
    return {
      code: 0,
      signal: null,
      success: true,
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
    };
  }
}
