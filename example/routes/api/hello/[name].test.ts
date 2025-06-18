import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { server } from "/main.ts";

describe("GET /api/hello/[name]", () => {
  it("GET should return json with hello [name] message", async () => {
    const res = await server.request("http://localhost/api/hello/earth");
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { message: "Hello, earth!" });
  });
});
