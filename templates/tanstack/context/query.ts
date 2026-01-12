import { createContext } from "react-router";
import {
  dehydrate,
  hydrate as hydrateQueryClient,
  QueryClient,
} from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";

import { registerContext } from "@udibo/juniper";

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

// Register QueryClient context serialization
registerContext<QueryClient, DehydratedState | undefined>({
  name: "queryClient",
  context: queryClientContext,
  serialize: (queryClient) => dehydrate(queryClient),
  deserialize: (dehydratedState) => {
    const queryClient = createQueryClient();
    if (dehydratedState) {
      hydrateQueryClient(queryClient, dehydratedState);
    }
    return queryClient;
  },
});
