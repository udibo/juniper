import { delay } from "@std/async/delay";

export interface ServerDeferredLoaderData {
  fastData: string;
  slowData: Promise<string>;
  verySlowData: Promise<string>;
  timestamp: string;
}

export function loader(): ServerDeferredLoaderData {
  // This runs on the server - we can access server-only resources here
  const timestamp = new Date().toISOString();

  return {
    fastData: `Server data loaded at ${timestamp}`,
    // These promises will be serialized and streamed to the client
    slowData: delay(1500).then(() => "Server data loaded after 1.5 seconds"),
    verySlowData: delay(3000).then(
      () => "Server data loaded after 3 seconds",
    ),
    timestamp,
  };
}
