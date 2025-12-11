import { postService } from "@/services/post.ts";

import type { Post } from "@/services/post.ts";

const DEFAULT_LIMIT = 5;
export const PREV_STACK_LIMIT = 10;

export interface BlogIndexLoaderData {
  posts: Post[];
  cursor: string;
  prevCursors: string[];
  currentCursor: string;
  limit: number;
}

function trimPrevStack(stack: string[]): string[] {
  return stack.slice(-PREV_STACK_LIMIT);
}

function decodePrevStack(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(atob(value));
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function encodePrevStack(stack: string[]): string | undefined {
  const trimmed = trimPrevStack(stack);
  if (trimmed.length === 0) return undefined;
  return btoa(JSON.stringify(trimmed));
}

export async function loader(
  args: { params: Record<string, string | undefined>; request: Request },
): Promise<BlogIndexLoaderData> {
  const url = new URL(args.request.url);
  const searchParams = url.searchParams;
  const cursor = searchParams.get("cursor") ?? undefined;
  const prevCursors = trimPrevStack(decodePrevStack(searchParams.get("prev")));
  const limitParam = searchParams.get("limit");
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const limit = parsedLimit !== undefined &&
      Number.isFinite(parsedLimit) &&
      parsedLimit > 0
    ? parsedLimit
    : DEFAULT_LIMIT;

  const { entries: posts, cursor: nextCursor } = await postService.list({
    cursor,
    limit,
    index: "updatedAt",
    reverse: true,
  });

  return {
    posts,
    cursor: nextCursor ?? "",
    prevCursors,
    currentCursor: cursor ?? "",
    limit,
  };
}
