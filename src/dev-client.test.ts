import { assert, assertEquals, assertFalse } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { assertSpyCalls, spy } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";

import { createDevClientScript } from "./_server.tsx";

class TestEventSource extends EventTarget {
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  closeCalls = 0;

  constructor(readonly url: string) {
    super();
  }

  close(): void {
    this.closed = true;
    this.closeCalls++;
  }

  fail(): void {
    this.onerror?.(new Event("error"));
  }

  emit(type: string, data: string): void {
    this.dispatchEvent(new MessageEvent(type, { data }));
  }
}

class ReloadDocument extends EventTarget {
  constructor(public readyState: "complete" | "loading") {
    super();
  }
}

class ReloadClientFixture implements Disposable {
  readonly time = new FakeTime(0);
  readonly sources: TestEventSource[] = [];
  readonly window = new EventTarget();
  readonly unloadListener = spy(this.window.addEventListener.bind(this.window));
  readonly reload = spy(() => {});
  readonly schedule = spy(setTimeout);
  readonly cancel = spy(clearTimeout);
  readonly document: ReloadDocument;

  constructor(readyState: "complete" | "loading" = "complete", port?: number) {
    this.document = new ReloadDocument(readyState);
    const sources = this.sources;
    class OwnedEventSource extends TestEventSource {
      constructor(url: string) {
        super(url);
        sources.push(this);
      }
    }
    try {
      const execute = new Function(
        "EventSource",
        "document",
        "globalThis",
        "setTimeout",
        "clearTimeout",
        createDevClientScript(port),
      );
      execute(
        OwnedEventSource,
        this.document,
        {
          addEventListener: this.unloadListener,
          removeEventListener: this.window.removeEventListener.bind(
            this.window,
          ),
          location: { reload: this.reload },
        },
        this.schedule,
        this.cancel,
      );
    } catch (error) {
      this[Symbol.dispose]();
      throw error;
    }
  }

  ready(): void {
    this.document.readyState = "complete";
    this.document.dispatchEvent(new Event("DOMContentLoaded"));
  }

  unload(): void {
    this.window.dispatchEvent(new Event("beforeunload"));
  }

  get activeSources(): number {
    return this.sources.filter((source) => !source.closed).length;
  }

  [Symbol.dispose](): void {
    try {
      this.unload();
      for (const call of this.schedule.calls) {
        clearTimeout(call.returned);
      }
      for (const source of this.sources) source.close();
    } finally {
      this.time.restore();
    }
  }
}

describe("development reload client ownership", () => {
  it("connects once immediately at the configured port", () => {
    using fixture = new ReloadClientFixture("complete", 3210);
    assertEquals(fixture.sources.map((source) => source.url), [
      "http://localhost:3210/sse",
    ]);
    assertEquals(fixture.activeSources, 1);
    assertSpyCalls(fixture.unloadListener, 1);
    assertSpyCalls(fixture.schedule, 0);
  });

  it("connects once after DOM readiness at the default port", () => {
    using fixture = new ReloadClientFixture("loading");
    assertEquals(fixture.sources.length, 0);
    fixture.ready();
    assertEquals(fixture.sources.map((source) => source.url), [
      "http://localhost:9001/sse",
    ]);
    assertEquals(fixture.activeSources, 1);
  });

  it("closes a failed source before the five-second replacement", () => {
    using fixture = new ReloadClientFixture();
    fixture.sources[0]!.fail();
    assert(fixture.sources[0]!.closed);
    assertEquals(fixture.activeSources, 0);
    assertSpyCalls(fixture.schedule, 1);
    fixture.time.tick(4999);
    assertEquals(fixture.sources.length, 1);
    fixture.time.tick(1);
    assertEquals(fixture.sources.length, 2);
    assertEquals(fixture.activeSources, 1);
  });

  it("schedules only one replacement for repeated source errors", () => {
    using fixture = new ReloadClientFixture();
    fixture.sources[0]!.fail();
    fixture.sources[0]!.fail();
    fixture.sources[0]!.fail();
    assertSpyCalls(fixture.schedule, 1);
    fixture.time.tick(5000);
    assertEquals(fixture.sources.length, 2);
    assertEquals(fixture.activeSources, 1);
    assertFalse(fixture.time.next());
  });

  it("retains one unload listener through repeated replacements", () => {
    using fixture = new ReloadClientFixture();
    for (let retry = 0; retry < 3; retry++) {
      fixture.sources.at(-1)!.fail();
      fixture.time.tick(5000);
    }
    assertEquals(fixture.sources.length, 4);
    assertEquals(fixture.activeSources, 1);
    assertSpyCalls(fixture.unloadListener, 1);
  });

  it("ignores error callbacks from a replaced source", () => {
    using fixture = new ReloadClientFixture();
    const stale = fixture.sources[0]!;
    stale.fail();
    fixture.time.tick(5000);
    stale.fail();
    assertSpyCalls(fixture.schedule, 1);
    assertFalse(fixture.time.next());
    assertEquals(fixture.sources.length, 2);
    assertEquals(fixture.activeSources, 1);
  });

  it("cancels a replacement on unload and cannot reconnect later", () => {
    using fixture = new ReloadClientFixture();
    fixture.sources[0]!.fail();
    fixture.unload();
    assertSpyCalls(fixture.cancel, 1);
    assertFalse(fixture.time.next());
    assertEquals(fixture.sources.length, 1);
    assertEquals(fixture.activeSources, 0);
  });

  it("does not start after unloading before DOM readiness", () => {
    using fixture = new ReloadClientFixture("loading");
    fixture.unload();
    fixture.ready();
    assertEquals(fixture.sources.length, 0);
    assertSpyCalls(fixture.schedule, 0);
  });

  it("closes an established source once when unload repeats", () => {
    using fixture = new ReloadClientFixture();
    fixture.unload();
    fixture.unload();
    assertEquals(fixture.sources[0]!.closeCalls, 1);
    assertEquals(fixture.activeSources, 0);
    assertFalse(fixture.time.next());
  });

  it("ignores error callbacks after unload", () => {
    using fixture = new ReloadClientFixture();
    fixture.unload();
    fixture.sources[0]!.fail();
    assertSpyCalls(fixture.schedule, 0);
    assertFalse(fixture.time.next());
    assertEquals(fixture.sources.length, 1);
  });

  it("ignores reload callbacks from a replaced source", () => {
    using fixture = new ReloadClientFixture();
    const stale = fixture.sources[0]!;
    stale.fail();
    fixture.time.tick(5000);
    stale.emit("dev-reload", '{"build":"old"}');
    assertSpyCalls(fixture.reload, 0);
    fixture.sources[1]!.emit("dev-reload", '{"build":"current"}');
    assertSpyCalls(fixture.reload, 1);
  });

  it("ignores reload callbacks after unload", () => {
    using fixture = new ReloadClientFixture();
    fixture.unload();
    fixture.sources[0]!.emit("dev-reload", '{"build":"old"}');
    assertSpyCalls(fixture.reload, 0);
  });

  it("reloads valid data and handles malformed payloads without retry", () => {
    using fixture = new ReloadClientFixture();
    fixture.sources[0]!.emit("dev-reload", '{"build":"current"}');
    fixture.sources[0]!.emit("dev-reload", "not-json");
    assertSpyCalls(fixture.reload, 1);
    assertSpyCalls(fixture.schedule, 0);
    assertEquals(fixture.activeSources, 1);
  });

  it("keeps connection and keepalive messages without replacement", () => {
    using fixture = new ReloadClientFixture();
    fixture.sources[0]!.emit("dev-connection", "connected");
    fixture.sources[0]!.emit("dev-keepalive", "keepalive");
    assertSpyCalls(fixture.reload, 0);
    assertSpyCalls(fixture.schedule, 0);
    assertEquals(fixture.activeSources, 1);
  });
});
