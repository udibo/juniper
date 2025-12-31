import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { server } from "@/main.ts";

describe("GET /api", () => {
  it("should return not found error", async () => {
    const res = await server.request("http://localhost/api");
    assertEquals(res.status, 404);
    const json = await res.json();
    assertEquals(json.status, 404);
    assertEquals(json.title, "Not Found");
  });
});

describe("GET /api/empty", () => {
  it("should return not found error", async () => {
    const res = await server.request("http://localhost/api/empty");
    assertEquals(res.status, 404);
    const json = await res.json();
    assertEquals(json.status, 404);
    assertEquals(json.title, "Not Found");
  });
});
