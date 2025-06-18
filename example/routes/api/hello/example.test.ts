import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";

import { server } from "/main.ts";

describe("example route", () => {
  it("should return example message", async () => {
    const res = await server.request("http://localhost/api/hello/example");

    assertEquals(res.status, 200);

    const json = await res.json();
    assertEquals(
      json.message,
      "This is an example of a named route in the same directory as a dynamic route.",
    );
  });
});
