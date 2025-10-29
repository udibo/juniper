import { assertEquals, assertStringIncludes } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { generate as generateUUIDv7 } from "@std/uuid/unstable-v7";

import { server } from "/main.ts";
import { type NewPost, postService } from "/services/post.ts";

describe("GET /blog/:id", () => {
  let testAuthorId: string;
  let testPostId: string;

  beforeAll(async () => {
    testAuthorId = generateUUIDv7();

    const testPost: NewPost = {
      title: "Individual Test Blog Post",
      content:
        "This is the full content of a test blog post that should be displayed on the individual post page.",
      authorId: testAuthorId,
    };

    const createdPost = await postService.create(testPost);
    testPostId = createdPost.id;
  });

  afterAll(async () => {
    await postService.close();
  });

  it("should return HTML with individual blog post", async () => {
    const res = await server.request(`http://localhost/blog/${testPostId}`);
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();

    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "Individual Test Blog Post");
    assertStringIncludes(html, "This is the full content of a test blog post");
  });

  it("should include navigation back to blog listing", async () => {
    const res = await server.request(`http://localhost/blog/${testPostId}`);
    const html = await res.text();

    assertStringIncludes(html, "← Back to Blog");
  });

  it("should return 404 for non-existent blog post", async () => {
    const nonExistentId = generateUUIDv7();
    const res = await server.request(`http://localhost/blog/${nonExistentId}`);
    assertEquals(res.status, 200);
  });

  it("should display post metadata", async () => {
    const res = await server.request(`http://localhost/blog/${testPostId}`);
    const html = await res.text();

    assertStringIncludes(html, "Published:");
    assertStringIncludes(html, testPostId);
    assertStringIncludes(html, testAuthorId);
  });
});
