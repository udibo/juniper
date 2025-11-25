import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { server } from "@/main.ts";

describe("GET /api/hello/[name]", () => {
  it("GET should return json with hello [name] message", async () => {
    const res = await server.request("http://localhost/api/hello2/earth");
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { message: "Hello, earth!" });
  });
});
