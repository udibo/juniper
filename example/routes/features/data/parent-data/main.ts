import type { RouteLoaderArgs } from "@udibo/juniper";

import type { ParentLoaderData } from "./main.tsx";

export async function loader(
  _args: RouteLoaderArgs,
): Promise<ParentLoaderData> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    parentMessage: "Hello from parent loader!",
    loadedAt: new Date().toISOString(),
    sharedConfig: {
      theme: "dark",
      version: "1.0.0",
    },
  };
}
