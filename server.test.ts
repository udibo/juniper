import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { createApp } from "./server.ts";

describe("createApp", () => {
  it("should return 404 for a non-existent route", async () => {
    const app = createApp(import.meta.url, {
      path: "/",
    });
    const res = await app.request("http://localhost/non-existent-route");
    assertEquals(res.status, 404);
  });
});
