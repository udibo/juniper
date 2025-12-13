import type { RouteLoaderArgs } from "@udibo/juniper";

import type { ServerData } from "./client-calls-server.tsx";

export async function loader(_args: RouteLoaderArgs): Promise<ServerData> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return {
    serverMessage: "Secure data from server",
    serverTimestamp: new Date().toISOString(),
    secretData: `API Key Hash: ${Math.random().toString(36).substring(2, 10)}`,
  };
}
