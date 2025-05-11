import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { eq } from "drizzle-orm";

import { app } from "/main.ts";
import { closeDb, getDb } from "/database/mod.ts";
import { type NewPost, type Post, postsTable } from "/database/schema/posts.ts";
import {
  type userInsertSchemaType,
  usersTable,
} from "/database/schema/users.ts";
import { createPost, deletePost } from "/services/posts.ts";

describe("Blog Posts API Routes", () => {
  let db: ReturnType<typeof getDb>;
  let testUserId: string;

  beforeAll(async () => {
    db = getDb();
    const newUserData: userInsertSchemaType = {
      username: "blogroutetestuser",
      displayName: "Blog Route Test User",
      email: "blog.route.test@example.com",
    };
    const [createdUser] = await db.insert(usersTable).values(newUserData)
      .returning();
    testUserId = createdUser.id;
  });

  const cleanupTestUserPosts = async () => {
    const userPosts = await db.select({ id: postsTable.id }).from(postsTable)
      .where(eq(postsTable.authorId, testUserId));
    for (const post of userPosts) {
      try {
        await deletePost(post.id, true);
      } catch (error) {
        if (!(error instanceof Error && error.message.includes("not found"))) {
          console.warn(`Cleanup: Error deleting post ${post.id}:`, error);
        }
      }
    }
  };

  afterAll(async () => {
    await cleanupTestUserPosts();
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));
    await closeDb();
  });

  beforeEach(async () => {
    await cleanupTestUserPosts();
  });

  describe("GET /api/blog/posts", () => {
    it("should return an empty array when no posts exist for this user context", async () => {
      const res = await app.request("/api/blog/posts");
      const json = await res.json();

      assertEquals(res.status, 200);
      const postsFromTestUser = json.posts.filter((p: Post) =>
        p.authorId === testUserId
      );
      assertEquals(postsFromTestUser.length, 0);
    });

    it("should return a list of posts including those created by testUser", async () => {
      const post1Data: NewPost = {
        title: "Post 1 by Router Test via Service",
        content: "Content 1",
        authorId: testUserId,
      };
      const post2Data: NewPost = {
        title: "Post 2 by Router Test via Service",
        content: "Content 2",
        authorId: testUserId,
      };
      const { post: createdPost1 } = await createPost(post1Data);
      const { post: createdPost2 } = await createPost(post2Data);

      const res = await app.request("/api/blog/posts");
      const json = await res.json();

      assertEquals(res.status, 200);
      const foundPost1 = json.posts.find((p: Post) => p.id === createdPost1.id);
      const foundPost2 = json.posts.find((p: Post) => p.id === createdPost2.id);
      assertEquals(foundPost1?.title, post1Data.title);
      assertEquals(foundPost2?.title, post2Data.title);
    });
  });

  describe("GET /api/blog/posts/:id", () => {
    it("should return a specific post if found", async () => {
      const singlePostData: NewPost = {
        title: "Specific Post by Router Test via Service",
        content: "Specific Content",
        authorId: testUserId,
      };
      const { post: insertedPost } = await createPost(singlePostData);

      const res = await app.request(
        `/api/blog/posts/${insertedPost.id}`,
      );
      const json = await res.json();

      assertEquals(res.status, 200);
      assertEquals(json.post.id, insertedPost.id);
      assertEquals(json.post.title, singlePostData.title);
    });

    it("should return 404 if post not found", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const res = await app.request(
        `/api/blog/posts/${nonExistentId}`,
      );
      assertEquals(res.status, 404);
      assertEquals(await res.json(), {
        status: 404,
        title: "NotFoundError",
        detail: "Post not found",
      });
    });
  });
});
