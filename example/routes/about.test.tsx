import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes } from "@std/assert";

import { server } from "/main.ts";

describe("GET /about", () => {
  it("should return HTML from converted client route", async () => {
    const res = await server.request("http://localhost/about");
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "About Juniper");
  });
});
