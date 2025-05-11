import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { app } from "/main.ts";

describe("GET /api/hello/[name]", () => {
  it("GET should return json with hello [name] message", async () => {
    const res = await app.request("http://localhost/api/hello2/earth");
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { message: "Hello, earth!" });
  });
});
