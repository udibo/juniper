import { assertEquals, assertStringIncludes } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { generate as generateUUIDv7 } from "@std/uuid/unstable-v7";

import { server } from "@/main.ts";
import { postService } from "@/services/post.ts";
import type { NewPost, Post } from "@/services/post.ts";

describe("GET /blog (index)", () => {
  let testPost: Post;

  beforeAll(async () => {
    const testAuthorId = generateUUIDv7();
    const testPostData: NewPost = {
      title: "Test Blog Post",
      content: "This is test content for the blog post listing page.",
      authorId: testAuthorId,
    };

    testPost = await postService.create(testPostData);
  });

  afterAll(async () => {
    try {
      await postService.delete(testPost.id);
    } catch {
      // ignore cleanup errors
    }
    postService.close();
  });

  it("should return HTML with blog posts listing", async () => {
    const res = await server.request("http://localhost/blog");
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();

    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "Blog Posts");
    assertStringIncludes(html, "Test Blog Post");
  });

  it("should include navigation back to home", async () => {
    const res = await server.request("http://localhost/blog");
    const html = await res.text();

    assertStringIncludes(html, "← Home");
  });
});
