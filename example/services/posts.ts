import { and, eq, isNull, sql } from "drizzle-orm";
import { HttpError } from "@udibo/http-error";

import { getDb } from "/database/mod.ts";
import { type NewPost, type Post, postsTable } from "/database/schema/posts.ts";

export interface GetPostsResponse {
  posts: Post[];
}

export async function getPosts(): Promise<GetPostsResponse> {
  const db = getDb();
  try {
    const posts = await db
      .select()
      .from(postsTable)
      .where(isNull(postsTable.deletedAt))
      .limit(10);

    return { posts };
  } catch (cause) {
    if (cause instanceof HttpError) throw cause;
    throw new HttpError(500, "Failed to get posts", {
      cause,
    });
  }
}

export interface GetPostResponse {
  post: Post;
}

export async function getPost(id: string): Promise<GetPostResponse> {
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
    if (cause instanceof HttpError) throw cause;
    throw new HttpError(500, "Failed to get post", {
      cause,
    });
  }
}

export interface CreatePostResponse {
  post: Post;
}

export async function createPost(post: NewPost): Promise<CreatePostResponse> {
  const db = getDb();
  try {
    const [newPost] = await db
      .insert(postsTable)
      .values(post)
      .returning();

    return { post: newPost };
  } catch (cause) {
    if (cause instanceof HttpError) throw cause;
    throw new HttpError(500, "Failed to create post", {
      cause,
    });
  }
}

export interface DeletePostResponse {
  post: Post;
}

export async function deletePost(
  id: string,
  hard: boolean = false,
): Promise<DeletePostResponse> {
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
    if (cause instanceof HttpError) throw cause;
    throw new HttpError(500, "Failed to delete post", {
      cause,
    });
  }
}
