import {
  assert,
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "@std/testing/bdd";
import { stub } from "@std/testing/mock";

import { HttpError } from "@udibo/juniper";

import { server } from "@/main.ts";
import { postService } from "@/services/post.ts";
import type { Post } from "@/services/post.ts";

interface JsonPost extends Omit<Post, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
}

const title = "A tutorial post";
const content = "A".repeat(151);
const injectedId = "caller-controlled-id";
const injectedDate = "2000-01-01T00:00:00.000Z";

describe("blog API post fields and real private storage", () => {
  let kv: Deno.Kv | undefined;
  let allocation: Disposable | undefined;

  beforeAll(async () => {
    kv = await Deno.openKv(":memory:");
    try {
      allocation = stub(Deno, "openKv", (path?: string) => {
        assertEquals(path, undefined, "unexpected tutorial KV allocation");
        assert(kv);
        return Promise.resolve(kv);
      });
    } catch (error) {
      kv.close();
      kv = undefined;
      throw error;
    }
  });

  beforeEach(async () => {
    assert(kv);
    for await (const entry of kv.list({ prefix: [] })) {
      await kv.delete(entry.key);
    }
  });

  afterAll(() => {
    try {
      allocation?.[Symbol.dispose]();
    } finally {
      kv?.close();
    }
  });

  function request(method: string, path: string, body?: unknown) {
    return server.request(`http://localhost/api/posts${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function storedPosts() {
    assert(kv);
    const entries: Deno.KvEntry<Post>[] = [];
    for await (const entry of kv.list<Post>({ prefix: ["posts"] })) {
      entries.push(entry);
    }
    return entries;
  }

  async function createPost(extra: Record<string, unknown> = {}) {
    const response = await request("POST", "", { title, content, ...extra });
    const json = await response.json() as { data: JsonPost };
    assertEquals(response.status, 201);
    return json.data;
  }

  async function assertRefused(
    method: "POST" | "PUT",
    path: string,
    body: unknown,
    message: string,
  ) {
    const before = await storedPosts();
    const response = await request(method, path, body);
    const text = await response.text();
    assertEquals(await storedPosts(), before, "invalid input changed storage");
    assertEquals(response.status, 400);
    assertEquals(JSON.parse(text), { error: message });
  }

  it("creates, retrieves, lists and deletes a valid post", async () => {
    const post = await createPost();
    assertMatch(post.id, /^[0-9a-f-]{36}$/);
    assertEquals(post.title, title);
    assertEquals(post.content, content);
    assertEquals(post.excerpt, "A".repeat(150) + "...");
    assertEquals(post.createdAt, post.updatedAt);
    assert(!Number.isNaN(Date.parse(post.createdAt)));

    const entries = await storedPosts();
    assertEquals(entries.length, 1);
    assertEquals(entries[0].key, ["posts", post.id]);
    assert(entries[0].value.createdAt instanceof Date);
    assertEquals(entries[0].value.createdAt.toISOString(), post.createdAt);

    const get = await request("GET", `/${post.id}`);
    assertEquals(await get.json(), { data: post });
    assertEquals(get.status, 200);
    const list = await request("GET", "");
    assertEquals(await list.json(), { data: [post] });
    assertEquals(list.status, 200);
    const remove = await request("DELETE", `/${post.id}`);
    assertEquals(await remove.text(), "");
    assertEquals(remove.status, 204);
    assertEquals(await storedPosts(), []);
    const missing = await request("GET", `/${post.id}`);
    const missingBody = await missing.text();
    assertEquals(missing.status, 404);
    assertStringIncludes(missingBody, "Post not found");
  });

  it("keeps generated identity and owned fields on POST", async () => {
    const post = await createPost({
      id: injectedId,
      excerpt: "injected excerpt",
      createdAt: injectedDate,
      updatedAt: injectedDate,
      unknown: "ignored",
    });
    assertNotEquals(post.id, injectedId);
    assertNotEquals(post.createdAt, injectedDate);
    assertNotEquals(post.updatedAt, injectedDate);
    assertEquals(Object.keys(post).sort(), [
      "content",
      "createdAt",
      "excerpt",
      "id",
      "title",
      "updatedAt",
    ]);
    const stored = await storedPosts();
    assertEquals(stored.length, 1);
    assertEquals(stored[0].key, ["posts", post.id]);
    assertEquals(stored[0].value.id, post.id);
  });

  it("retrieves an extra-key POST by its returned id", async () => {
    const post = await createPost({ id: injectedId });
    const response = await request("GET", `/${post.id}`);
    const text = await response.text();
    assertEquals(response.status, 200);
    assertEquals(JSON.parse(text), { data: post });
  });

  it("keeps existing identity and creation date on PUT", async () => {
    const post = await createPost();
    const response = await request("PUT", `/${post.id}`, {
      title: "Updated title",
      id: injectedId,
      createdAt: injectedDate,
      updatedAt: injectedDate,
      excerpt: "injected excerpt",
      unknown: "ignored",
    });
    const json = await response.json() as { data: JsonPost };
    assertEquals(response.status, 200);
    assertEquals(json.data.id, post.id);
    assertEquals(json.data.createdAt, post.createdAt);
    assertNotEquals(json.data.updatedAt, injectedDate);
    assertEquals(json.data.title, "Updated title");
    assertEquals(json.data.content, post.content);
    assertEquals(json.data.excerpt, post.excerpt);
    assertEquals(Object.keys(json.data).sort(), Object.keys(post).sort());
    const get = await request("GET", `/${post.id}`);
    assertEquals(await get.json(), json);
    assertEquals(get.status, 200);
  });

  it("preserves partial and empty PUT", async () => {
    const post = await createPost();
    for (
      const [body, expectedTitle, expectedContent] of [
        [{ title: "Partial title" }, "Partial title", content],
        [{ content: "Updated content" }, "Partial title", "Updated content"],
        [{}, "Partial title", "Updated content"],
      ] as const
    ) {
      const response = await request("PUT", `/${post.id}`, body);
      const json = await response.json() as { data: JsonPost };
      assertEquals(response.status, 200);
      assertEquals(json.data.id, post.id);
      assertEquals(json.data.createdAt, post.createdAt);
      assertEquals(json.data.title, expectedTitle);
      assertEquals(json.data.content, expectedContent);
      assertEquals(
        json.data.excerpt,
        expectedContent.slice(0, 150) +
          (expectedContent.length > 150 ? "..." : ""),
      );
      assert(!Number.isNaN(Date.parse(json.data.updatedAt)));
      assertEquals(Object.keys(json.data).sort(), Object.keys(post).sort());
    }
  });

  it("ignores unknown-only PUT fields", async () => {
    const post = await createPost();
    const response = await request("PUT", `/${post.id}`, {
      unknown: "ignored",
    });
    const json = await response.json() as { data: JsonPost };
    assertEquals(response.status, 200);
    assertEquals(json.data.id, post.id);
    assertEquals(json.data.createdAt, post.createdAt);
    assertEquals(json.data.title, post.title);
    assertEquals(json.data.content, post.content);
    assertEquals(json.data.excerpt, post.excerpt);
    assertEquals(Object.keys(json.data).sort(), Object.keys(post).sort());
  });

  it("accepts unchanged minimum lengths without trimming", async () => {
    const response = await request("POST", "", {
      title: "   ",
      content: " ".repeat(10),
    });
    const json = await response.json() as { data: JsonPost };
    assertEquals(response.status, 201);
    assertEquals(json.data.title, "   ");
    assertEquals(json.data.content, " ".repeat(10));
    const update = await request("PUT", `/${json.data.id}`, {
      title: "abc",
      content: "1234567890",
    });
    const updated = await update.json() as { data: JsonPost };
    assertEquals(update.status, 200);
    assertEquals(updated.data.title, "abc");
    assertEquals(updated.data.content, "1234567890");
  });

  for (const method of ["POST", "PUT"] as const) {
    for (
      const [name, body] of [
        ["null", null],
        ["array", []],
        ["string", "body"],
        ["number", 42],
        ["boolean", true],
      ] as const
    ) {
      it(`refuses ${name} ${method} bodies before storage`, async () => {
        const path = method === "PUT" ? `/${(await createPost()).id}` : "";
        await assertRefused(method, path, body, "Body must be a JSON object");
      });
    }

    for (const field of ["title", "content"] as const) {
      for (
        const [name, value] of [
          ["number", 42],
          ["boolean", false],
          ["null", null],
          ["array", Array.from({ length: 10 }, () => "x")],
          ["object", { length: 100 }],
        ] as const
      ) {
        it(`refuses ${name} ${field} in ${method}`, async () => {
          const path = method === "PUT" ? `/${(await createPost()).id}` : "";
          const body = method === "POST"
            ? { title, content, [field]: value }
            : { [field]: value };
          await assertRefused(
            method,
            path,
            body,
            field === "title"
              ? "Title must be at least 3 characters"
              : "Content must be at least 10 characters",
          );
        });
      }
    }

    it(`preserves short-field refusal for ${method}`, async () => {
      const path = method === "PUT" ? `/${(await createPost()).id}` : "";
      await assertRefused(
        method,
        path,
        { title: "ab", content },
        "Title must be at least 3 characters",
      );
      await assertRefused(
        method,
        path,
        { title, content: "123456789" },
        "Content must be at least 10 characters",
      );
    });
  }

  it("requires both modeled fields on POST", async () => {
    await assertRefused(
      "POST",
      "",
      { content },
      "Title must be at least 3 characters",
    );
    await assertRefused(
      "POST",
      "",
      { title },
      "Content must be at least 10 characters",
    );
  });

  it("protects owned fields from structural service creation", async () => {
    const input = {
      title,
      content,
      id: injectedId,
      excerpt: "injected excerpt",
      createdAt: new Date(injectedDate),
      updatedAt: new Date(injectedDate),
      unknown: "ignored",
    };
    const post = await postService.create(input);
    assertNotEquals(post.id, injectedId);
    assertNotEquals(post.createdAt.toISOString(), injectedDate);
    assertEquals(post.excerpt, "A".repeat(150) + "...");
    assertEquals(Object.keys(post).sort(), [
      "content",
      "createdAt",
      "excerpt",
      "id",
      "title",
      "updatedAt",
    ]);
    assertEquals(await postService.get(post.id), post);
  });

  it("protects owned fields from structural service updates", async () => {
    const original = await postService.create({ title, content });
    const input = {
      title: "Service title",
      id: injectedId,
      createdAt: new Date(injectedDate),
      updatedAt: new Date(injectedDate),
      excerpt: "injected excerpt",
      unknown: "ignored",
    };
    const post = await postService.update(original.id, input);
    assertEquals(post.id, original.id);
    assertEquals(post.createdAt, original.createdAt);
    assertEquals(post.content, original.content);
    assertEquals(post.excerpt, original.excerpt);
    assertEquals(Object.keys(post).sort(), Object.keys(original).sort());
    assertEquals(await postService.get(original.id), post);
    await assertRejects(
      () => postService.get(injectedId),
      HttpError,
      "Post not found",
    );
  });
});
