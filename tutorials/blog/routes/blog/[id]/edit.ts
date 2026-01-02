import type { RouteActionArgs, RouteLoaderArgs } from "@udibo/juniper";
import { redirect } from "react-router";
import { postService } from "@/services/post.ts";

export async function loader({ params }: RouteLoaderArgs<{ id: string }>) {
  const post = await postService.get(params.id);
  return { post };
}

export async function action({
  params,
  request,
}: RouteActionArgs<{ id: string }>) {
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

  await postService.update(params.id, { title, content });
  return redirect(`/blog/${params.id}`);
}
