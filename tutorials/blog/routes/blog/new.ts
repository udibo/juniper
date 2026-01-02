import type { RouteActionArgs } from "@udibo/juniper";
import { redirect } from "react-router";
import { postService } from "@/services/post.ts";

export async function action({ request }: RouteActionArgs) {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  // Validate
  const errors: Record<string, string> = {};
  if (!title || title.length < 3) {
    errors.title = "Title must be at least 3 characters";
  }
  if (!content || content.length < 10) {
    errors.content = "Content must be at least 10 characters";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, values: { title, content } };
  }

  const post = await postService.create({ title, content });
  return redirect(`/blog/${post.id}`);
}
