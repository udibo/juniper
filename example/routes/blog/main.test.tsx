import { afterAll, describe, it } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes } from "@std/assert";

import { server } from "/main.ts";
import { postService } from "/services/post.ts";

describe("GET /blog", () => {
  afterAll(() => {
    postService.close();
  });

  it("should return HTML from blog layout", async () => {
    const res = await server.request("http://localhost/blog");
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "Blog");
  });
});
