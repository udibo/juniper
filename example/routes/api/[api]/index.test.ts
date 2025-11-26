import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { server } from "@/main.ts";

describe("dynamic api route", () => {
  it("should throw 404 error for non-existent API", async () => {
    const res = await server.request("http://localhost/api/nonexistent");

    assertEquals(res.status, 404);

    assertEquals(await res.json(), {
      status: 404,
      title: "NotFoundError",
      detail: "nonexistent does not exist",
    });
  });
});
