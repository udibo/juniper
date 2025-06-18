import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { createServer } from "./server.ts";

describe("createServer", () => {
  it("should return 404 for a non-existent route", async () => {
    const server = createServer(import.meta.url, {
      path: "/",
    });
    const res = await server.request("http://localhost/non-existent-route");
    assertEquals(res.status, 404);
  });
});
