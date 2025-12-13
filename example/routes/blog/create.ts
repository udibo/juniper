import { redirect } from "react-router";

import { postService } from "@/services/post.ts";

export async function action(
  { request }: { params: Record<string, string | undefined>; request: Request },
): Promise<Response> {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const authorId = formData.get("authorId") as string;

  const post = await postService.create({ title, content, authorId });
  return redirect(`/blog/${post.id}`);
}
