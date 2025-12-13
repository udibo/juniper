import type { RouteLoaderArgs } from "@udibo/juniper";

import type { ServerLoaderData } from "./object.tsx";

export async function loader(
  _args: RouteLoaderArgs,
): Promise<ServerLoaderData> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    message: "Data loaded from the server!",
    timestamp: new Date().toISOString(),
    serverOnly: `Server PID: ${Deno.pid}`,
  };
}
