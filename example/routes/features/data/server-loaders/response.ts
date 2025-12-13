import type { RouteLoaderArgs } from "@udibo/juniper";

import type { ResponseLoaderData } from "./response.tsx";

export function loader(_args: RouteLoaderArgs): Response {
  const data: ResponseLoaderData = {
    title: "Custom Response Example",
    description: "Data loaded via a custom Response object",
    timestamp: new Date().toISOString(),
  };

  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "private, max-age=60",
    "X-Custom-Header": "Juniper-Demo",
  });

  return new Response(JSON.stringify(data), { headers });
}
