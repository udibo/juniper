import { delay } from "@std/async/delay";
import type { AnyParams, RouteActionArgs } from "@udibo/juniper";

import type { ResponseActionData } from "./response.tsx";

export async function action(
  { request }: RouteActionArgs<AnyParams, Response>,
): Promise<Response> {
  const formData = await request.formData();
  const input = formData.get("data") as string;

  await delay(400);

  const responseData: ResponseActionData = {
    success: true,
    message: `Processed: ${input}`,
    processedAt: new Date().toISOString(),
  };

  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Action-Id": crypto.randomUUID(),
  });

  return new Response(JSON.stringify(responseData), { status: 200, headers });
}
