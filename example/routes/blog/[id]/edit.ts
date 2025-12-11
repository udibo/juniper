import { redirect } from "react-router";

import { postService } from "@/services/post.ts";

import type { EditPostActionData, EditPostLoaderData } from "./edit.tsx";

export async function loader(
  { params }: { params: Record<string, string | undefined>; request: Request },
): Promise<EditPostLoaderData> {
  const post = await postService.get(params.id!);
  return { post };
}

export async function action(
  { request, params }: {
    params: Record<string, string | undefined>;
    request: Request;
  },
): Promise<EditPostActionData | Response> {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  await postService.patch({ id: params.id!, title, content });
  return redirect(`/blog/${params.id}`);
}
