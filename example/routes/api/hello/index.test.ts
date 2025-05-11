import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { app } from "/main.ts";

describe("GET /api/hello", () => {
  it("GET should return json with hello world message", async () => {
    const res = await app.request("http://localhost/api/hello");
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { message: "Hello, World!" });
  });
});
