import type { AnyParams, RouteLoaderArgs } from "@udibo/juniper";
import { delay } from "@std/async/delay";

import type { ServerLoaderData } from "./object.tsx";

export async function loader(
  _args: RouteLoaderArgs<AnyParams, ServerLoaderData>,
): Promise<ServerLoaderData> {
  await delay(200);
  return {
    message: "Data loaded from the server!",
    timestamp: new Date().toISOString(),
    serverOnly: `Server PID: ${Deno.pid}`,
  };
}
