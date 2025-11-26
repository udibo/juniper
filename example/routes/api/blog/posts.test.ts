import { assert, assertEquals } from "@std/assert";
import { afterAll, afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";
import { generate as generateUUIDv7 } from "@std/uuid/unstable-v7";

import { postService } from "@/services/post.ts";
import type { NewPost, Post } from "@/services/post.ts";
import { server } from "@/main.ts";

describe("/api/blog/posts", () => {
  let time: FakeTime;
  let testAuthorId: string;

  beforeAll(() => {
    time = new FakeTime();
    testAuthorId = generateUUIDv7();
  });

  afterAll(() => {
    time.restore();
  });

  describe("GET /", () => {
    const posts: Post[] = [];

    beforeAll(async () => {
      const author1 = generateUUIDv7();
      time.tick(500);
      const author2 = generateUUIDv7();

      const postsData: NewPost[] = [
        { title: "Post A", content: "Content A", authorId: author1 },
        { title: "Post B", content: "Content B", authorId: author2 },
        { title: "Post C", content: "Content C", authorId: author1 },
        { title: "Post D", content: "Content D", authorId: author2 },
      ];

      for (const data of postsData) {
        time.tick(500);
        posts.push(await postService.create(data));
      }
      time.tick(500);
      posts[0] = await postService.patch({
        id: posts[0].id,
        title: "Post A (updated)",
      });
      time.tick(500);
      posts[1] = await postService.patch({
        id: posts[1].id,
        title: "Post B (updated)",
      });
    });
    afterAll(() => postService.close());

    it("should return a list of posts", async () => {
      const res = await server.request("/api/blog/posts");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.posts, "Response should have a posts property");
      assertEquals(json.posts.length, posts.length);
      assertEquals(json.posts[0].id, posts[0].id);
      assertEquals(json.posts[0].title, posts[0].title);
      assertEquals(json.posts[1].id, posts[1].id);
      assertEquals(json.posts[1].title, posts[1].title);
    });

    it("should return a limited number of posts when limit parameter is provided", async () => {
      const res = await server.request("/api/blog/posts?limit=2");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.posts, "Response should have a posts property");
      assertEquals(json.posts.length, 2);
      assertEquals(json.posts[0].id, posts[0].id);
      assertEquals(json.posts[1].id, posts[1].id);
      assert(json.cursor, "Response should have a cursor for pagination");
    });

    it("should return posts in reverse order when reverse=true", async () => {
      const res = await server.request("/api/blog/posts?reverse=true");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.posts, "Response should have a posts property");
      assertEquals(json.posts.length, posts.length);
      assertEquals(json.posts[0].id, posts[3].id);
      assertEquals(json.posts[1].id, posts[2].id);
      assertEquals(json.posts[2].id, posts[1].id);
      assertEquals(json.posts[3].id, posts[0].id);
    });

    it("should return remaining posts when using cursor parameter", async () => {
      let res = await server.request("/api/blog/posts?limit=2");
      assertEquals(res.status, 200);
      let json = await res.json();
      assert(json.cursor, "First response should have a cursor");
      assertEquals(json.posts.length, 2);
      assertEquals(json.posts[0].id, posts[0].id);
      assertEquals(json.posts[1].id, posts[1].id);

      res = await server.request(
        `/api/blog/posts?limit=2&cursor=${json.cursor}`,
      );
      assertEquals(res.status, 200);
      json = await res.json();

      assert(json.posts, "Response should have a posts property");
      assertEquals(json.posts.length, 2);
      assertEquals(json.posts[0].id, posts[2].id);
      assertEquals(json.posts[1].id, posts[3].id);

      res = await server.request(
        `/api/blog/posts?limit=2&cursor=${json.cursor}`,
      );
      assertEquals(res.status, 200);
      json = await res.json();
      assertEquals(json.posts.length, 0);
      assertEquals(json.cursor, "");
    });

    it("should return posts sorted by authorId when using index parameter", async () => {
      const res = await server.request("/api/blog/posts?index=authorId");
      assertEquals(res.status, 200);
      const json = await res.json();

      assert(json.posts, "Response should have a posts property");
      assertEquals(json.posts.length, posts.length);
      assertEquals(json.posts[0].id, posts[0].id);
      assertEquals(json.posts[1].id, posts[2].id);
      assertEquals(json.posts[2].id, posts[1].id);
      assertEquals(json.posts[3].id, posts[3].id);
    });

    it("should return 400 error for invalid query parameters", async () => {
      const res = await server.request("/api/blog/posts?index=invalidIndex");
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assertEquals(
        errorBody.detail,
        'Invalid index "invalidIndex" for post. Valid indexes are: id, authorId, updatedAt.',
      );
      assert(errorBody.instance);
    });
  });

  describe("GET /:id", () => {
    afterEach(() => postService.close());

    it("should return a specific post if found", async () => {
      const createdPost = await postService.create({
        title: "Specific API Post",
        content: "Specific Content for API",
        authorId: testAuthorId,
      });

      const res = await server.request(`/api/blog/posts/${createdPost.id}`);
      const post = await res.json();

      assertEquals(res.status, 200);
      assertEquals(post.id, createdPost.id);
      assertEquals(post.title, createdPost.title);
    });

    it("should return 404 if post not found", async () => {
      const nonExistentId = generateUUIDv7();
      const res = await server.request(`/api/blog/posts/${nonExistentId}`);
      assertEquals(res.status, 404);

      const errorBody = await res.json();
      assertEquals(errorBody.status, 404);
      assertEquals(errorBody.title, "NotFoundError");
      assertEquals(errorBody.detail, "Failed to find post");
      assert(errorBody.instance);
    });
  });

  describe("POST /", () => {
    afterEach(() => postService.close());

    it("should create a new post and return it", async () => {
      const newPostData: NewPost = {
        title: "API Test Post",
        content: "Content for API test post.",
        authorId: testAuthorId,
      };

      const res = await server.request("/api/blog/posts", {
        method: "POST",
        body: JSON.stringify(newPostData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 201);
      const post = await res.json();

      assertEquals(post.title, newPostData.title);
      assertEquals(post.content, newPostData.content);
      assertEquals(post.authorId, newPostData.authorId);
      assert(post.id, "Post should have an id");
      assert(post.createdAt, "Post should have createdAt");
      assert(post.updatedAt, "Post should have updatedAt");
    });

    it("should return 400 if request body is invalid", async () => {
      const invalidPostData = {
        // Missing title and authorId
        content: "Invalid content only",
      };

      const res = await server.request("/api/blog/posts", {
        method: "POST",
        body: JSON.stringify(invalidPostData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assert(
        errorBody.detail.includes("Invalid post"),
        "Error detail should mention invalid post",
      );
      assert(
        errorBody.detail.includes("Field 'title' is required"),
        "Error detail should mention missing title",
      );
      assert(
        errorBody.detail.includes("Field 'authorId' is required"), // zod error message for authorId
        "Error detail should mention invalid authorId",
      );
    });
  });

  describe("PUT /:id", () => {
    afterEach(() => postService.close());

    it("should update an existing post and return it", async () => {
      const createdPost = await postService.create({
        title: "Original Title for PUT",
        content: "Original content for PUT",
        authorId: testAuthorId,
      });

      time.tick(1000);

      const updatedPostData = {
        title: "Updated API Test Post via PUT",
        content: "Updated content for API test post via PUT.",
        authorId: testAuthorId,
      };

      const res = await server.request(`/api/blog/posts/${createdPost.id}`, {
        method: "PUT",
        body: JSON.stringify(updatedPostData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 200);
      const post = await res.json();

      assertEquals(post.id, createdPost.id);
      assertEquals(post.title, updatedPostData.title);
      assertEquals(post.content, updatedPostData.content);
      assertEquals(post.authorId, updatedPostData.authorId);
      assert(
        new Date(post.updatedAt) > new Date(createdPost.updatedAt),
        "updatedAt should be newer",
      );
    });

    it("should return 404 if post to update is not found", async () => {
      const nonExistentId = generateUUIDv7();
      const updateData = {
        title: "Attempt to Update Non-existent",
        content: "Content for non-existent post.",
        authorId: testAuthorId,
        id: nonExistentId,
      };

      const res = await server.request(`/api/blog/posts/${nonExistentId}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 404);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 404);
      assertEquals(errorBody.title, "NotFoundError");
      assertEquals(errorBody.detail, "Failed to find post to update");
    });

    it("should return 400 if request body is invalid for PUT", async () => {
      const createdPost = await postService.create({
        title: "Test PUT Validation",
        content: "Content for PUT validation",
        authorId: testAuthorId,
      });
      const invalidUpdateData = {
        content: "Invalid update content.",
        authorId: testAuthorId,
        id: createdPost.id,
      };

      const res = await server.request(`/api/blog/posts/${createdPost.id}`, {
        method: "PUT",
        body: JSON.stringify(invalidUpdateData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assert(errorBody.detail.includes("Invalid post"));
      assert(errorBody.detail.includes("Field 'title' is required"));
    });
  });

  describe("PATCH /:id", () => {
    afterEach(() => postService.close());

    it("should partially update an existing post and return it", async () => {
      const createdPost = await postService.create({
        title: "Original Title for PATCH",
        content: "Original content for PATCH",
        authorId: testAuthorId,
      });

      time.tick(1000);

      const patchData = {
        content: "Patched content for API test post.",
      };

      const res = await server.request(`/api/blog/posts/${createdPost.id}`, {
        method: "PATCH",
        body: JSON.stringify(patchData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 200);
      const post = await res.json();

      assertEquals(post.id, createdPost.id);
      assertEquals(post.title, createdPost.title);
      assertEquals(post.content, patchData.content);
      assertEquals(post.authorId, createdPost.authorId);
      assert(
        new Date(post.updatedAt) > new Date(createdPost.updatedAt),
        "updatedAt should be newer",
      );
    });

    it("should return 404 if post to patch is not found", async () => {
      const nonExistentId = generateUUIDv7();
      const patchData = {
        title: "Attempt to Patch Non-existent",
      };

      const res = await server.request(`/api/blog/posts/${nonExistentId}`, {
        method: "PATCH",
        body: JSON.stringify(patchData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 404);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 404);
      assertEquals(errorBody.title, "NotFoundError");
      assertEquals(errorBody.detail, "Failed to find post to patch");
    });

    it("should return 400 if request body is invalid for PATCH", async () => {
      const createdPost = await postService.create({
        title: "Test PATCH Validation",
        content: "Content for PATCH validation",
        authorId: testAuthorId,
      });
      const invalidPatchData = {
        title: "a".repeat(300),
      };

      const res = await server.request(`/api/blog/posts/${createdPost.id}`, {
        method: "PATCH",
        body: JSON.stringify(invalidPatchData),
        headers: { "Content-Type": "application/json" },
      });
      assertEquals(res.status, 400);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 400);
      assertEquals(errorBody.title, "BadRequestError");
      assert(errorBody.detail.includes("Invalid post"));
      assert(
        errorBody.detail.includes("Title must be less than 255 characters"),
      );
    });
  });

  describe("DELETE /:id", () => {
    afterEach(() => postService.close());

    it("should delete an existing post and return a confirmation", async () => {
      const createdPost = await postService.create({
        title: "To Be Deleted Post",
        content: "Content of post to be deleted.",
        authorId: testAuthorId,
      });

      const res = await server.request(`/api/blog/posts/${createdPost.id}`, {
        method: "DELETE",
      });
      assertEquals(res.status, 200);
      const json = await res.json();
      assertEquals(json.deleted, true);

      const getRes = await server.request(`/api/blog/posts/${createdPost.id}`);
      assertEquals(getRes.status, 404);
    });

    it("should return 404 if post to delete is not found", async () => {
      const nonExistentId = generateUUIDv7();

      const res = await server.request(`/api/blog/posts/${nonExistentId}`, {
        method: "DELETE",
      });
      assertEquals(res.status, 404);
      const errorBody = await res.json();
      assertEquals(errorBody.status, 404);
      assertEquals(errorBody.title, "NotFoundError");
      assertEquals(errorBody.detail, "Failed to find post to delete");
    });
  });
});
