import { redirect } from "react-router";

import { postService } from "@/services/post.ts";

import type { BlogPostLoaderData } from "./index.tsx";

export async function loader(
  { params }: { params: Record<string, string | undefined>; request: Request },
): Promise<BlogPostLoaderData> {
  const post = await postService.get(params.id!);
  return { post };
}

export async function action(
  { params }: {
    params: Record<string, string | undefined>;
    request: Request;
  },
): Promise<Response> {
  await postService.delete(params.id!);
  return redirect("/blog");
}
