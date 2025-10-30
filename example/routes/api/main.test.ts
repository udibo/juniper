import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { server } from "/main.ts";

describe("GET /api", () => {
  it("should return not found error", async () => {
    const res = await server.request("http://localhost/api");
    assertEquals(res.status, 404);
    assertEquals(await res.json(), {
      status: 404,
      title: "NotFoundError",
      detail: "Not found",
    });
  });
});

describe("GET /api/empty", () => {
  it("should return not found error", async () => {
    const res = await server.request("http://localhost/api/empty");
    assertEquals(res.status, 404);
    assertEquals(await res.json(), {
      status: 404,
      title: "NotFoundError",
      detail: "Not found",
    });
  });
});
