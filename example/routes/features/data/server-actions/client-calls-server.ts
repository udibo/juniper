import type { RouteActionArgs } from "@udibo/juniper";
import { delay } from "@std/async/delay";

import type { ServerMutationResult } from "./client-calls-server.tsx";

export async function action(
  { request }: RouteActionArgs,
): Promise<ServerMutationResult> {
  const formData = await request.formData();
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  await delay(400);

  return {
    success: true,
    message: `Saved "${title}" with ${content.length} characters`,
    savedAt: new Date().toISOString(),
    recordId: crypto.randomUUID().slice(0, 8),
  };
}
