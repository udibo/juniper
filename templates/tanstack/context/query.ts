import { createContext } from "react-router";
import { QueryClient } from "@tanstack/react-query";

export const queryClientContext = createContext<QueryClient>();

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
      },
    },
  });
}
