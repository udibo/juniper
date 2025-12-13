import type { RouteActionArgs } from "@udibo/juniper";

import type { ServerActionData } from "./object.tsx";

export async function action(
  { request }: RouteActionArgs,
): Promise<ServerActionData> {
  const formData = await request.formData();
  const name = formData.get("name") as string;

  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    success: true,
    message: `Hello, ${name}! Your form was processed on the server.`,
    timestamp: new Date().toISOString(),
    serverProcessed: true,
  };
}
