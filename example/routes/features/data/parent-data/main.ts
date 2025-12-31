import { delay } from "@std/async/delay";

import type { ParentLoaderData } from "./main.tsx";

export async function loader(): Promise<ParentLoaderData> {
  await delay(300);
  return {
    parentMessage: "Hello from parent loader!",
    loadedAt: new Date().toISOString(),
    sharedConfig: {
      theme: "dark",
      version: "1.0.0",
    },
  };
}
