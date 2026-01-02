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
  const intent = formData.get("intent");

  if (intent === "delete") {
    await postService.delete(params.id);
    return redirect("/blog");
  }

  return null;
}
