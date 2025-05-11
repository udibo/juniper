import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { app } from "/main.ts";

describe("GET /api/catchall/[...]", () => {
  it("GET should return json with splat", async () => {
    const res = await app.request("http://localhost/api/catchall/a/b/c");
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { splat: "a/b/c" });
  });

  it("GET should return not found error for empty splat", async () => {
    let res = await app.request("http://localhost/api/catchall");
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { splat: "" });

    res = await app.request("http://localhost/api/catchall/");
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { splat: "" });
  });
});
