import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { app } from "/main.ts";

describe("GET /hello", () => {
  it("should return hello world", async () => {
    const res = await app.request("http://localhost/hello");
    assertEquals(res.status, 200);
    assertEquals(await res.text(), "Hello, World!");
  });
});
