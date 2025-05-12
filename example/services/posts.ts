import { and, eq, isNull, sql } from "drizzle-orm";
import { HttpError } from "@udibo/http-error";

import { getDb } from "/database/mod.ts";
import { type NewPost, type Post, postsTable } from "/database/schema/posts.ts";
import { startActiveSpan } from "/utils/otel.ts";

export interface GetPostsResponse {
  posts: Post[];
}

export function getPosts(): Promise<GetPostsResponse> {
  return startActiveSpan("getPosts", async (span) => {
    span.setAttribute("limit", 10);
    const db = getDb();
    try {
      const posts = await db
        .select()
        .from(postsTable)
        .where(isNull(postsTable.deletedAt))
        .limit(10);

      return { posts };
    } catch (cause) {
      const error = cause instanceof HttpError
        ? cause
        : new HttpError(500, "Failed to get posts", {
          cause,
        });
      throw error;
    }
  });
}

export interface GetPostResponse {
  post: Post;
}

export function getPost(id: string): Promise<GetPostResponse> {
  return startActiveSpan("getPost", async (span) => {
    span.setAttribute("id", id);
    const db = getDb();
    try {
      const post = await db
        .select()
        .from(postsTable)
        .where(and(
          eq(postsTable.id, id),
          isNull(postsTable.deletedAt),
        ));

      if (!post.length) throw new HttpError(404, "Post not found");
      return { post: post[0] };
    } catch (cause) {
      const error = cause instanceof HttpError
        ? cause
        : new HttpError(500, "Failed to get post", {
          cause,
        });
      throw error;
    }
  });
}

export interface CreatePostResponse {
  post: Post;
}

export function createPost(post: NewPost): Promise<CreatePostResponse> {
  return startActiveSpan("createPost", async (span) => {
    span.setAttribute("title", post.title);
    span.setAttribute("authorId", post.authorId);
    const db = getDb();
    try {
      const [newPost] = await db
        .insert(postsTable)
        .values(post)
        .returning();

      return { post: newPost };
    } catch (cause) {
      const error = cause instanceof HttpError
        ? cause
        : new HttpError(500, "Failed to create post", {
          cause,
        });
      throw error;
    }
  });
}

export interface DeletePostResponse {
  post: Post;
}

export function deletePost(
  id: string,
  hard: boolean = false,
): Promise<DeletePostResponse> {
  return startActiveSpan("deletePost", async (span) => {
    span.setAttribute("id", id);
    span.setAttribute("hard", hard);
    const db = getDb();
    try {
      let deletedPost: Post | undefined;
      if (hard) {
        [deletedPost] = await db
          .delete(postsTable)
          .where(eq(postsTable.id, id))
          .returning();
      } else {
        [deletedPost] = await db
          .update(postsTable)
          .set({ deletedAt: sql`now()` })
          .where(eq(postsTable.id, id))
          .returning();
      }

      if (!deletedPost) throw new HttpError(404, "Post not found");
      return { post: deletedPost };
    } catch (cause) {
      const error = cause instanceof HttpError
        ? cause
        : new HttpError(500, "Failed to delete post", {
          cause,
        });
      throw error;
    }
  });
}
