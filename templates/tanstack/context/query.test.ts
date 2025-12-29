import { assertEquals, assertInstanceOf } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { QueryClient } from "@tanstack/react-query";

import { createQueryClient, queryClientContext } from "./query.ts";

describe("query context", () => {
  describe("queryClientContext", () => {
    it("should be a context object", () => {
      assertEquals(typeof queryClientContext, "object");
    });
  });

  describe("createQueryClient", () => {
    it("should return a QueryClient instance", () => {
      const client = createQueryClient();
      assertInstanceOf(client, QueryClient);
    });

    it("should return a new instance each time", () => {
      const client1 = createQueryClient();
      const client2 = createQueryClient();
      assertEquals(client1 !== client2, true);
    });

    it("should have default staleTime of 1 minute", () => {
      const client = createQueryClient();
      const defaults = client.getDefaultOptions();
      assertEquals(defaults.queries?.staleTime, 1000 * 60);
    });
  });
});
