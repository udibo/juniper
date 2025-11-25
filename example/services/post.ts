import { z } from "zod";

import { Service } from "./service.ts";

export const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string()
    .min(1, "Title is required")
    .max(255, "Title must be less than 255 characters"),
  content: z.string().min(1, "Content is required"),
  authorId: z.string().uuid("Invalid author ID"),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Post = z.infer<typeof PostSchema>;
export type NewPost = Omit<Post, "id" | "createdAt" | "updatedAt">;
export type PostPatch = Partial<Post> & { id: string };

export const postService = new Service({
  name: "post",
  schema: PostSchema,
  uniqueIndexes: [],
  indexes: ["authorId", "updatedAt"],
});
