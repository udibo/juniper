import type { LoaderData } from "./client-middleware.tsx";

export function loader(): LoaderData {
  return {
    navigationInfo: {
      navigatedAt: new Date().toISOString(),
      path: "/features/middleware/client-middleware",
    },
    serverTime: new Date().toISOString(),
    message: "Data loaded from server!",
  };
}
