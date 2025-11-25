import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { server } from "@/main.ts";

describe("GET /", () => {
  it("should return HTML from React component", async () => {
    const res = await server.request("http://localhost/");
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "Welcome to Juniper");
  });
});
