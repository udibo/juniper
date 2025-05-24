import { afterAll, afterEach, beforeAll, describe, it } from "@std/testing/bdd";
import {
  assertEquals,
  assertExists,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import { FakeTime } from "@std/testing/time";
import { sortBy } from "@std/collections/sort-by";
import { HttpError } from "@udibo/http-error";
import { generate as generateUUIDv7 } from "@std/uuid/unstable-v7";

import { type NewPost, type Post, postService } from "./post.ts";

describe("PostService", () => {
  let time: FakeTime;

  beforeAll(() => {
    time = new FakeTime();
  });

  afterAll(() => {
    time.restore();
  });

  const createSamplePostInput = (
    override?: Partial<NewPost>,
  ): NewPost => ({
    title: "Test Post Title",
    content: "This is the content of the test post.",
    authorId: generateUUIDv7(),
    ...override,
  });

  describe("create", () => {
    afterEach(() => postService.close());

    it("should create a new post and return it", async () => {
      const newPostData = createSamplePostInput();
      const createdPost = await postService.create(newPostData);

      assertExists(createdPost.id);
      assertEquals(createdPost.title, newPostData.title);
      assertEquals(createdPost.content, newPostData.content);
      assertEquals(createdPost.authorId, newPostData.authorId);
      assertExists(createdPost.createdAt);
      assertExists(createdPost.updatedAt);
      assertEquals(createdPost.createdAt, createdPost.updatedAt);
    });

    it("should fail to create a post with invalid data (e.g., missing title)", async () => {
      const invalidPostData = {
        content: "Some content.",
        authorId: generateUUIDv7(),
      } as NewPost;

      await assertRejects(
        () => postService.create(invalidPostData),
        HttpError,
        "Invalid post: Field 'title' is required.",
      );
    });

    it("should fail to create a post with invalid authorId", async () => {
      const invalidPostData = createSamplePostInput({
        authorId: "not-a-uuid",
      });
      await assertRejects(
        () => postService.create(invalidPostData),
        HttpError,
        "Invalid post: Invalid author ID",
      );
    });
  });

  describe("get", () => {
    afterEach(() => postService.close());

    it("should retrieve an existing post by its ID", async () => {
      const newPostData = createSamplePostInput();
      const createdPost = await postService.create(newPostData);
      const retrievedPost = await postService.get(createdPost.id);

      assertEquals(retrievedPost, createdPost);
    });

    it("should throw HttpError if post with given ID does not exist", async () => {
      const nonExistentId = generateUUIDv7();
      await assertRejects(
        () => postService.get(nonExistentId),
        HttpError,
        "Failed to find post",
      );
    });
  });

  describe("getBy (unique indexes - PostService has none by default)", () => {
    afterEach(() => postService.close());

    it("should throw error when trying to getBy a non-configured unique index", async () => {
      await assertRejects(
        () => postService.getBy("title", "Some Title"),
        HttpError,
        `Index "title" is not a valid unique index for post. Valid unique indexes are: .`,
      );
    });
  });

  describe("update", () => {
    afterEach(() => postService.close());

    it("should update an existing post and return the updated post", async () => {
      const initialPostData = createSamplePostInput();
      const createdPost = await postService.create(initialPostData);

      time.tick(1000);

      const updates: Omit<Post, "createdAt" | "updatedAt"> = {
        id: createdPost.id,
        title: "Updated Post Title",
        content: "Updated post content.",
        authorId: createdPost.authorId,
      };

      const updatedPost = await postService.update(updates);

      assertEquals(updatedPost.id, createdPost.id);
      assertEquals(updatedPost.title, updates.title);
      assertEquals(updatedPost.content, updates.content);
      assertEquals(updatedPost.authorId, updates.authorId);
      assertEquals(updatedPost.createdAt, createdPost.createdAt);
      assertNotEquals(updatedPost.updatedAt, createdPost.updatedAt);
      assertEquals(
        updatedPost.updatedAt.getTime() - createdPost.createdAt.getTime(),
        1000,
      );

      const retrievedPost = await postService.get(createdPost.id);
      assertEquals(retrievedPost, updatedPost);
    });

    it("should fail to update a post that does not exist", async () => {
      const nonExistentPostUpdate: Omit<Post, "createdAt" | "updatedAt"> = {
        id: generateUUIDv7(),
        title: "Non Existent",
        content: "No content",
        authorId: generateUUIDv7(),
      };
      await assertRejects(
        () => postService.update(nonExistentPostUpdate),
        HttpError,
        "Failed to find post to update",
      );
    });

    it("should fail to update with invalid data (e.g., empty title)", async () => {
      const createdPost = await postService.create(createSamplePostInput());
      const invalidUpdate = {
        id: createdPost.id,
        title: "",
        content: "Valid content",
        authorId: createdPost.authorId,
      };
      await assertRejects(
        () => postService.update(invalidUpdate),
        HttpError,
        "Invalid post: Title is required",
      );
    });
  });

  describe("patch", () => {
    afterEach(() => postService.close());

    it("should partially update an existing post", async () => {
      const initialPostData = createSamplePostInput();
      const createdPost = await postService.create(initialPostData);

      time.tick(1000);

      const patchData = {
        id: createdPost.id,
        content: "Patched post content.",
      };
      const patchedPost = await postService.patch(patchData);

      assertEquals(patchedPost.id, createdPost.id);
      assertEquals(patchedPost.title, createdPost.title);
      assertEquals(patchedPost.content, patchData.content);
      assertEquals(patchedPost.authorId, createdPost.authorId);
      assertEquals(patchedPost.createdAt, createdPost.createdAt);
      assertNotEquals(patchedPost.updatedAt, createdPost.updatedAt);
      assertEquals(
        patchedPost.updatedAt.getTime() - createdPost.createdAt.getTime(),
        1000,
      );

      const retrievedPost = await postService.get(createdPost.id);
      assertEquals(retrievedPost, patchedPost);
    });

    it("should fail to patch a post that does not exist", async () => {
      const nonExistentPostPatch = {
        id: generateUUIDv7(),
        title: "Trying to patch",
      };
      await assertRejects(
        () => postService.patch(nonExistentPostPatch),
        HttpError,
        "Failed to find post to patch",
      );
    });

    it("should fail to patch with invalid data (e.g., title too long)", async () => {
      const createdPost = await postService.create(createSamplePostInput());
      const invalidPatch = {
        id: createdPost.id,
        title: "a".repeat(256),
      };
      await assertRejects(
        () => postService.patch(invalidPatch),
        HttpError,
        "Invalid post: Title must be less than 255 characters",
      );
    });
  });

  describe("delete", () => {
    afterEach(() => postService.close());

    it("should delete an existing post", async () => {
      const newPostData = createSamplePostInput();
      const createdPost = await postService.create(newPostData);

      await postService.delete(createdPost.id);

      await assertRejects(
        () => postService.get(createdPost.id),
        HttpError,
        "Failed to find post",
      );
    });

    it("should fail to delete a post that does not exist", async () => {
      await assertRejects(
        () => postService.delete(generateUUIDv7()),
        HttpError,
        "Failed to find post to delete",
      );
    });
  });

  describe("list", () => {
    const posts: Post[] = [];

    beforeAll(async () => {
      const author1 = generateUUIDv7();
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

    it("should return all posts with default options (sorted by id)", async () => {
      const { entries, cursor } = await postService.list();
      assertEquals(entries.length, posts.length);
      assertEquals(entries, posts);
      assertEquals(cursor, "");
    });

    it("should return a limited number of posts", async () => {
      const limit = 2;
      const { entries, cursor } = await postService.list({ limit });
      assertEquals(entries.length, limit);
      assertEquals(entries, posts.slice(0, limit));
      assertExists(cursor);
      assertNotEquals(cursor, "");
    });

    it("should return remaining posts using cursor", async () => {
      const limit = 3;
      let { entries, cursor } = await postService.list({ limit });
      assertEquals(entries, posts.slice(0, limit));
      assertExists(cursor);
      assertNotEquals(cursor, "");

      ({ entries, cursor } = await postService.list({
        cursor,
        limit,
      }));
      assertEquals(entries, posts.slice(limit));
      assertEquals(cursor, "");
    });

    it("should return posts in reverse order (sorted by id descending)", async () => {
      const { entries, cursor } = await postService.list({ reverse: true });
      assertEquals(entries.length, posts.length);
      assertEquals(entries, [...posts].reverse());
      assertEquals(cursor, "");
    });

    describe("list by 'updatedAt' index", () => {
      let postsSortedByUpdatedAt: Post[];

      beforeAll(() => {
        postsSortedByUpdatedAt = sortBy(
          posts,
          (post) => post.updatedAt.getTime(),
        );
      });

      it("should list all posts sorted by 'updatedAt', then by id", async () => {
        const { entries, cursor } = await postService.list({
          index: "updatedAt",
        });
        assertEquals(entries.length, postsSortedByUpdatedAt.length);
        assertEquals(entries, postsSortedByUpdatedAt);
        assertEquals(cursor, "");
      });

      it("should list posts by 'updatedAt' with limit", async () => {
        const limit = 2;
        const { entries, cursor: c } = await postService.list({
          index: "updatedAt",
          limit,
        });
        assertEquals(entries.length, limit);
        assertEquals(entries, postsSortedByUpdatedAt.slice(0, limit));
        assertExists(c);
        assertNotEquals(c, "");
      });

      it("should list remaining posts by 'updatedAt' with cursor", async () => {
        const limit = 2;
        const firstPage = await postService.list({
          index: "updatedAt",
          limit,
        });
        assertExists(firstPage.cursor);

        const secondPage = await postService.list({
          index: "updatedAt",
          cursor: firstPage.cursor,
          limit: postsSortedByUpdatedAt.length,
        });
        assertEquals(
          secondPage.entries.length,
          postsSortedByUpdatedAt.length - limit,
        );
        assertEquals(
          secondPage.entries,
          postsSortedByUpdatedAt.slice(limit),
        );
        assertEquals(secondPage.cursor, "");
      });

      it("should list posts by 'updatedAt' in reverse order", async () => {
        const { entries, cursor: c } = await postService.list({
          index: "updatedAt",
          reverse: true,
        });
        assertEquals(entries.length, postsSortedByUpdatedAt.length);
        assertEquals(entries, [...postsSortedByUpdatedAt].reverse());
        assertEquals(c, "");
      });
    });

    describe("list by 'authorId' index", () => {
      let postsSortedByAuthorId: Post[];

      beforeAll(() => {
        postsSortedByAuthorId = sortBy(
          posts,
          (post) => `${post.authorId}-${post.id}`,
        );
      });

      it("should list all posts sorted by 'authorId', then by id", async () => {
        const { entries, cursor } = await postService.list({
          index: "authorId",
        });
        assertEquals(entries.length, postsSortedByAuthorId.length);
        assertEquals(entries, postsSortedByAuthorId);
        assertEquals(cursor, "");
      });

      it("should list posts by 'authorId' with limit", async () => {
        const limit = 2;
        const { entries, cursor: c } = await postService.list({
          index: "authorId",
          limit,
        });
        assertEquals(entries.length, limit);
        assertEquals(entries, postsSortedByAuthorId.slice(0, limit));
        assertExists(c);
        assertNotEquals(c, "");
      });

      it("should list remaining posts by 'authorId' with cursor", async () => {
        const limit = 2;
        const firstPage = await postService.list({
          index: "authorId",
          limit,
        });
        assertExists(firstPage.cursor);

        const secondPage = await postService.list({
          index: "authorId",
          cursor: firstPage.cursor,
          limit: postsSortedByAuthorId.length,
        });
        assertEquals(
          secondPage.entries.length,
          postsSortedByAuthorId.length - limit,
        );
        assertEquals(
          secondPage.entries,
          postsSortedByAuthorId.slice(limit),
        );
        assertEquals(secondPage.cursor, "");
      });

      it("should list posts by 'authorId' in reverse order", async () => {
        const { entries, cursor: c } = await postService.list({
          index: "authorId",
          reverse: true,
        });
        assertEquals(entries.length, postsSortedByAuthorId.length);
        assertEquals(entries, [...postsSortedByAuthorId].reverse());
        assertEquals(c, "");
      });
    });

    it("should throw HttpError if listing by a non-existent index", async () => {
      await assertRejects(
        () => postService.list({ index: "content" }),
        HttpError,
        `Index "content" is not a valid index for post. Valid indexes are: id, authorId, updatedAt.`,
      );
    });
  });
});
