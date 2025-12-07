import { assertEquals, assertStringIncludes } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";

import { server } from "@/main.ts";
import { postService } from "@/services/post.ts";

describe("GET /blog (index)", () => {
  afterEach(() => {
    postService.close();
  });

  it("should return HTML with blog page structure", async () => {
    const res = await server.request("http://localhost/blog");
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();

    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "Blog Posts");
  });

  it("should include navigation back to home", async () => {
    const res = await server.request("http://localhost/blog");
    const html = await res.text();

    assertStringIncludes(html, "Home");
  });
});
