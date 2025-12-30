import { assertEquals, assertMatch } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { createServerSession, serverSessionContext } from "./server-session.ts";

describe("server-session context", () => {
  describe("serverSessionContext", () => {
    it("should be a context object", () => {
      assertEquals(typeof serverSessionContext, "object");
    });
  });

  describe("createServerSession", () => {
    it("should return a ServerSession with expected properties", () => {
      const session = createServerSession();

      assertEquals(typeof session.sessionId, "string");
      assertEquals(session.sessionId.length, 8);
      assertEquals(typeof session.serverTimestamp, "string");
      assertEquals(typeof session.serverPid, "number");
    });

    it("should return a valid ISO timestamp", () => {
      const session = createServerSession();
      const date = new Date(session.serverTimestamp);

      assertEquals(isNaN(date.getTime()), false);
    });

    it("should return the current process PID", () => {
      const session = createServerSession();

      assertEquals(session.serverPid, Deno.pid);
    });

    it("should return a new session with different sessionId each time", () => {
      const session1 = createServerSession();
      const session2 = createServerSession();

      assertEquals(session1.sessionId !== session2.sessionId, true);
    });

    it("should have sessionId as first 8 characters of a UUID", () => {
      const session = createServerSession();

      // UUID first segment is 8 hex characters
      assertMatch(session.sessionId, /^[0-9a-f]{8}$/);
    });
  });
});
