import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { app } from "/main.ts";

describe("dynamic api route", () => {
  it("should throw 404 error for non-existent API", async () => {
    const res = await app.request("http://localhost/api/nonexistent");

    assertEquals(res.status, 404);

    assertEquals(await res.json(), {
      status: 404,
      title: "NotFoundError",
      detail: "nonexistent does not exist",
    });
  });
});
