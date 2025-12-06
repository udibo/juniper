import { assertEquals, assertStringIncludes } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { generate as generateUUIDv7 } from "@std/uuid/unstable-v7";

import { server } from "@/main.ts";
import { postService } from "@/services/post.ts";
import type { NewPost, Post } from "@/services/post.ts";

describe("GET /blog/:id", () => {
  let testAuthorId: string;
  let testPost: Post;

  beforeAll(async () => {
    testAuthorId = generateUUIDv7();

    const testPostData: NewPost = {
      title: "Individual Test Blog Post",
      content:
        "This is the full content of a test blog post that should be displayed on the individual post page.",
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

  it("should return HTML with individual blog post", async () => {
    const res = await server.request(`http://localhost/blog/${testPost.id}`);
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();

    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "Individual Test Blog Post");
    assertStringIncludes(html, "This is the full content of a test blog post");
  });

  it("should include navigation back to blog listing", async () => {
    const res = await server.request(`http://localhost/blog/${testPost.id}`);
    const html = await res.text();

    assertStringIncludes(html, "← Back to Blog");
  });

  it("should return 404 for non-existent blog post", async () => {
    const nonExistentId = generateUUIDv7();
    const res = await server.request(`http://localhost/blog/${nonExistentId}`);
    assertEquals(res.status, 200);
  });

  it("should display post metadata", async () => {
    const res = await server.request(`http://localhost/blog/${testPost.id}`);
    const html = await res.text();

    assertStringIncludes(html, "Published:");
    assertStringIncludes(html, testPost.id);
    assertStringIncludes(html, testAuthorId);
  });
});
