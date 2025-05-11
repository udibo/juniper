import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "@std/testing/bdd";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { HttpError } from "@udibo/http-error";
import { eq } from "drizzle-orm";

import { closeDb, getDb, simulateDbFailure } from "/database/mod.ts";
import { type NewPost, type Post, postsTable } from "/database/schema/posts.ts";
import {
  type userInsertSchemaType,
  usersTable,
} from "/database/schema/users.ts";
import { createPost, deletePost, getPost, getPosts } from "./posts.ts";

describe("PostsService", () => {
  let db: ReturnType<typeof getDb>;
  let testUserId: string;

  beforeAll(async () => {
    db = getDb();
    const testUsername = "poststestuser";

    await db.delete(usersTable).where(eq(usersTable.username, testUsername));

    const newUserData: userInsertSchemaType = {
      username: testUsername,
      displayName: "Posts Test User",
      email: "posts.test@example.com",
    };
    const [testUser] = await db.insert(usersTable).values(newUserData)
      .returning();
    testUserId = testUser.id;
  });

  afterAll(async () => {
    if (db) {
      await db.delete(postsTable);
      if (testUserId) {
        await db.delete(usersTable).where(eq(usersTable.id, testUserId));
      }
    }
    await closeDb();
  });

  describe("getPosts()", () => {
    beforeEach(async () => {
      await db.delete(postsTable);
    });

    it("should return an empty array when no posts exist", async () => {
      const { posts } = await getPosts();
      assertEquals(posts.length, 0);
    });

    it("should return a list of posts, excluding deleted ones", async () => {
      const post1Data: NewPost = {
        title: "Post 1",
        content: "Content 1",
        authorId: testUserId,
      };
      const post2Data: NewPost = {
        title: "Post 2",
        content: "Content 2",
        authorId: testUserId,
      };
      const deletedPostData: NewPost = {
        title: "Deleted Post",
        content: "Content deleted",
        authorId: testUserId,
      };

      await db.insert(postsTable).values([
        post1Data,
        post2Data,
        deletedPostData,
      ]);
      const [deletedEntry] = await db.select().from(postsTable).where(
        eq(postsTable.title, "Deleted Post"),
      );
      await db.update(postsTable).set({ deletedAt: new Date() }).where(
        eq(postsTable.id, deletedEntry.id),
      );

      const { posts } = await getPosts();

      assertEquals(posts.length, 2);
      assertEquals(posts[0].title, post1Data.title);
      assertEquals(posts[1].title, post2Data.title);
      assertEquals(posts.find((p) => p.title === "Deleted Post"), undefined);
    });

    it("should limit posts to 10 by default", async () => {
      const postArray: NewPost[] = [];
      for (let i = 0; i < 15; i++) {
        postArray.push({
          title: `Post ${i}`,
          content: `Content ${i}`,
          authorId: testUserId,
        });
      }
      await db.insert(postsTable).values(postArray);

      const { posts } = await getPosts();
      assertEquals(posts.length, 10);
    });

    it("should throw HttpError 500 if database operation fails", async () => {
      try {
        await simulateDbFailure();
        await assertRejects(
          async () => {
            await getPosts();
          },
          HttpError,
          "Failed to get posts",
        );
      } finally {
        await closeDb();
        db = getDb();
      }
    });
  });

  describe("getPost()", () => {
    let testPost: Post;

    beforeEach(async () => {
      await db.delete(postsTable);
      const postData: NewPost = {
        title: "Test Post for Get",
        content: "Content for get",
        authorId: testUserId,
      };
      [testPost] = await db.insert(postsTable).values(postData).returning();
    });

    it("should return a post when a valid ID is provided", async () => {
      const { post } = await getPost(testPost.id);
      assertEquals(post.id, testPost.id);
      assertEquals(post.title, "Test Post for Get");
    });

    it("should throw HttpError 404 if post does not exist", async () => {
      await assertRejects(
        async () => {
          await getPost("00000000-0000-0000-0000-000000000000");
        },
        HttpError,
        "Post not found",
      );
    });

    it("should throw HttpError 404 if post is soft-deleted", async () => {
      await db.update(postsTable)
        .set({ deletedAt: new Date() })
        .where(eq(postsTable.id, testPost.id));

      await assertRejects(
        async () => {
          await getPost(testPost.id);
        },
        HttpError,
        "Post not found",
      );
    });

    it("should throw HttpError 500 if database operation fails", async () => {
      try {
        await simulateDbFailure();
        await assertRejects(
          async () => {
            await getPost(testPost.id);
          },
          HttpError,
          "Failed to get post",
        );
      } finally {
        await closeDb();
        db = getDb();
      }
    });
  });

  describe("createPost()", () => {
    beforeEach(async () => {
      await db.delete(postsTable);
    });

    it("should create a new post and return it", async () => {
      const newPostData: NewPost = {
        title: "New Awesome Post",
        content: "This is the content of the new awesome post.",
        authorId: testUserId,
      };

      const { post: createdPost } = await createPost(newPostData);

      assertExists(createdPost.id);
      assertEquals(createdPost.title, newPostData.title);
      assertEquals(createdPost.content, newPostData.content);
      assertEquals(createdPost.authorId, newPostData.authorId);
      assertExists(createdPost.createdAt);
      assertExists(createdPost.updatedAt);
      assertEquals(createdPost.deletedAt, null);

      const dbPost = await db.select().from(postsTable).where(
        eq(postsTable.id, createdPost.id),
      );
      assertExists(dbPost[0]);
      assertEquals(dbPost[0].title, newPostData.title);
    });

    it("should throw HttpError 500 if database operation fails", async () => {
      const newPostData: NewPost = {
        title: "Error Post",
        content: "Content for error post",
        authorId: testUserId,
      };
      try {
        await simulateDbFailure();
        await assertRejects(
          async () => {
            await createPost(newPostData);
          },
          HttpError,
          "Failed to create post",
        );
      } finally {
        await closeDb();
        db = getDb();
      }
    });
  });

  describe("deletePost()", () => {
    let testPost: Post;

    beforeEach(async () => {
      await db.delete(postsTable);
      const postData: NewPost = {
        title: "Test Post for Delete Operations",
        content: "Content for delete operations",
        authorId: testUserId,
      };
      [testPost] = await db.insert(postsTable).values(postData).returning();
    });

    it("should soft-delete a post when hard=false and return it with deletedAt set", async () => {
      const { post: deletedPost } = await deletePost(testPost.id, false);

      assertExists(deletedPost);
      assertEquals(deletedPost.id, testPost.id);
      assertExists(deletedPost.deletedAt);

      const dbPost = await db.select().from(postsTable).where(
        eq(postsTable.id, testPost.id),
      );
      assertExists(dbPost[0]);
      assertExists(dbPost[0].deletedAt);
    });

    it("should soft-delete a post by default (hard not specified) and return it with deletedAt set", async () => {
      const { post: deletedPost } = await deletePost(testPost.id);

      assertExists(deletedPost);
      assertEquals(deletedPost.id, testPost.id);
      assertExists(deletedPost.deletedAt);

      const dbPost = await db.select().from(postsTable).where(
        eq(postsTable.id, testPost.id),
      );
      assertExists(dbPost[0]);
      assertExists(dbPost[0].deletedAt);
    });

    it("should not be retrievable by getPost after soft deletion", async () => {
      await deletePost(testPost.id, false);
      await assertRejects(
        async () => {
          await getPost(testPost.id);
        },
        HttpError,
        "Post not found",
      );
    });

    it("should not be included in getPosts after soft deletion", async () => {
      const anotherPostData: NewPost = {
        title: "Another Post",
        content: "Content here",
        authorId: testUserId,
      };
      await db.insert(postsTable).values(anotherPostData).returning();
      await deletePost(testPost.id, false);
      const { posts } = await getPosts();
      assertEquals(posts.length, 1);
      assertEquals(posts[0].title, "Another Post");
    });

    it("should throw 404 when soft-deleting a non-existent post ID", async () => {
      const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";
      await assertRejects(
        async () => {
          await deletePost(nonExistentId, false);
        },
        HttpError,
        "Post not found",
      );
      try {
        await deletePost(nonExistentId, false);
      } catch (e) {
        if (e instanceof HttpError) {
          assertEquals(e.status, 404);
        } else {
          throw e;
        }
      }
    });

    it("should return the post with deletedAt if trying to soft-delete an already soft-deleted post", async () => {
      await deletePost(testPost.id, false);
      const { post: reDeletedPost } = await deletePost(testPost.id, false);
      assertExists(reDeletedPost);
      assertEquals(reDeletedPost.id, testPost.id);
      assertExists(reDeletedPost.deletedAt);
    });

    it("should hard-delete a post when hard=true and return it", async () => {
      const { post: deletedPostData } = await deletePost(testPost.id, true);

      assertEquals(deletedPostData.id, testPost.id);
      assertEquals(deletedPostData.title, testPost.title);
      assertEquals(deletedPostData.deletedAt, null);

      const dbResult = await db.select().from(postsTable).where(
        eq(postsTable.id, testPost.id),
      );
      assertEquals(dbResult.length, 0);
    });

    it("should not be retrievable by getPost after hard deletion", async () => {
      await deletePost(testPost.id, true);
      await assertRejects(
        async () => {
          await getPost(testPost.id);
        },
        HttpError,
        "Post not found",
      );
    });

    it("should not be included in getPosts after hard deletion", async () => {
      const anotherPostData: NewPost = {
        title: "Another Surviving Post",
        content: "Content here",
        authorId: testUserId,
      };
      await db.insert(postsTable).values(anotherPostData).returning();

      await deletePost(testPost.id, true);

      const { posts } = await getPosts();
      assertEquals(posts.length, 1);
      assertEquals(posts[0].title, "Another Surviving Post");
    });

    it("should throw 404 when hard-deleting a non-existent post ID", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      await assertRejects(
        async () => {
          await deletePost(nonExistentId, true);
        },
        HttpError,
        "Post not found",
      );
      try {
        await deletePost(nonExistentId, true);
      } catch (e) {
        if (e instanceof HttpError) {
          assertEquals(e.status, 404);
        } else {
          throw e;
        }
      }
    });

    it("should throw 404 when trying to hard-delete an already hard-deleted post", async () => {
      await deletePost(testPost.id, true);
      await assertRejects(
        async () => {
          await deletePost(testPost.id, true);
        },
        HttpError,
        "Post not found",
      );
    });

    it("should throw HttpError 500 if database operation fails during soft delete", async () => {
      try {
        await simulateDbFailure();
        await assertRejects(
          async () => {
            await deletePost(testPost.id, false);
          },
          HttpError,
          "Failed to delete post",
        );
      } finally {
        await closeDb();
        db = getDb();
      }
    });

    it("should throw HttpError 500 if database operation fails during hard delete", async () => {
      try {
        await simulateDbFailure();
        await assertRejects(
          async () => {
            await deletePost(testPost.id, true);
          },
          HttpError,
          "Failed to delete post",
        );
      } finally {
        await closeDb();
        db = getDb();
      }
    });

    it("should successfully hard-delete a previously soft-deleted post", async () => {
      const { post: softDeletedPost } = await deletePost(testPost.id, false);
      assertExists(softDeletedPost.deletedAt);

      const dbPost = await db.select().from(postsTable).where(
        eq(postsTable.id, testPost.id),
      );
      assertExists(dbPost[0]?.deletedAt);

      const { post: hardDeletedPostData } = await deletePost(testPost.id, true);
      assertEquals(hardDeletedPostData.id, testPost.id);
      assertExists(hardDeletedPostData.deletedAt);

      const dbResult = await db.select().from(postsTable).where(
        eq(postsTable.id, testPost.id),
      );
      assertEquals(dbResult.length, 0);
    });
  });
});
