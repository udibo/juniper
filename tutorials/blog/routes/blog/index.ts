import type { RouteLoaderArgs } from "@udibo/juniper";
import { postService } from "@/services/post.ts";

export async function loader(_args: RouteLoaderArgs) {
  const posts = await postService.list();
  return { posts };
}
