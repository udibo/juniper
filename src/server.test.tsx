import {
  assertEquals,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Outlet, useLoaderData, useParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { HttpError } from "@udibo/http-error";

import { Client } from "@udibo/juniper/client";
import { createServer } from "@udibo/juniper/server";
import { simulateEnvironment } from "@udibo/juniper/utils/testing";

import { serializeErrorDefault } from "./_server.tsx";

describe("createServer", () => {
  it("should return 404 for a non-existent route", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => <div>Home</div> },
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
    });
    const res = await server.request("http://localhost/non-existent-route");
    assertEquals(res.status, 404);
  });

  it("should convert client routes to server routes with HTML response", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => <Outlet /> },
      children: [
        {
          path: "about",
          main: () => Promise.resolve({ default: () => <div>About</div> }),
        },
        {
          path: "contact",
          index: () => Promise.resolve({ default: () => <div>Contact</div> }),
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
    });

    const aboutRes = await server.request("http://localhost/about");
    assertEquals(aboutRes.status, 200);
    assertEquals(
      aboutRes.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    const aboutText = await aboutRes.text();
    assertStringIncludes(aboutText, "<!DOCTYPE html>");
    assertStringIncludes(aboutText, "<div>About</div>");

    const contactRes = await server.request("http://localhost/contact");
    assertEquals(contactRes.status, 200);
    assertEquals(
      contactRes.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    const contactText = await contactRes.text();
    assertStringIncludes(contactText, "<!DOCTYPE html>");
    assertStringIncludes(contactText, "<div>Contact</div>");
  });

  it("should give priority to server routes over client routes", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => <Outlet /> },
      children: [
        {
          path: "test",
          main: () => Promise.resolve({ default: () => <div>Test</div> }),
        },
      ],
    });

    const testApp = new (await import("hono")).Hono();
    testApp.get("/", (c) => c.text("Server Route"));

    const server = createServer(import.meta.url, client, {
      path: "/",
      children: [
        {
          path: "test",
          main: { default: testApp },
        },
      ],
    });

    // Server route should take priority and return plain text, not HTML
    const testRes = await server.request("http://localhost/test");
    assertEquals(testRes.status, 200);
    assertEquals(await testRes.text(), "Server Route");
  });

  it("should forward loader headers to the HTML response", async () => {
    const client = new Client({
      path: "/",
      main: {
        default: () => <div>Home</div>,
        loader: () =>
          Promise.resolve(
            new Response(null, {
              headers: new Headers([["X-Loader", "yes"]]),
            }),
          ),
      },
    });

    const server = createServer(import.meta.url, client, { path: "/" });
    const res = await server.request("http://localhost/");
    assertEquals(res.status, 200);
    // Header is copied from loaderHeaders in server.tsx
    assertEquals(res.headers.get("x-loader"), "yes");
    const html = await res.text();
    assertStringIncludes(html, "<div>Home</div>");
  });

  it("should return JSON for data requests when Accept is application/json", async () => {
    const client = new Client({
      path: "/",
      main: {
        default: () => <div>Home</div>,
        loader: () => Promise.resolve({ ok: true }),
      },
    });

    const server = createServer(import.meta.url, client, { path: "/" });
    const res = await server.request("http://localhost/", {
      headers: { accept: "application/json" },
    });
    assertEquals(res.status, 200);
    const ct = res.headers.get("content-type");
    assertEquals(ct && ct.startsWith("application/json"), true);
    assertEquals(await res.json(), { ok: true });
  });

  it("should handle index routes correctly", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => <Outlet /> },
      children: [
        {
          path: "blog",
          index: () =>
            Promise.resolve({
              default: function BlogIndexPage() {
                const data = useLoaderData() as { posts: unknown[] };
                return <div>Blog Index Page - {data.posts.length} posts</div>;
              },
              loader: () => Promise.resolve({ posts: [] }),
            }),
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
    });

    const res = await server.request("http://localhost/blog");
    assertEquals(res.status, 200);
    assertEquals(
      res.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(
      html,
      "Blog Index Page - <!-- -->0<!-- --> posts",
    );
  });

  it("should handle parameterized routes correctly", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => <Outlet /> },
      children: [
        {
          path: "blog",
          main: { default: () => <Outlet /> },
          children: [
            {
              path: ":id",
              main: () =>
                Promise.resolve({
                  default: function BlogPostPage() {
                    const params = useParams();
                    const data = useLoaderData() as { postId: string };
                    return (
                      <div>
                        Blog Post Page - ID: {data.postId} | Params: {params.id}
                      </div>
                    );
                  },
                  loader: (args: LoaderFunctionArgs) =>
                    Promise.resolve({ postId: args.params.id }),
                }),
            },
          ],
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
    });

    const res = await server.request("http://localhost/blog/123");
    assertEquals(res.status, 200);
    assertEquals(
      res.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(
      html,
      "Blog Post Page - ID: <!-- -->123<!-- --> | Params: <!-- -->123",
    );
  });

  it("should handle catchall routes correctly", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => <Outlet /> },
      children: [
        {
          path: "api",
          main: { default: () => <Outlet /> },
          catchall: () =>
            Promise.resolve({
              default: function APICatchallPage() {
                const params = useParams();
                const data = useLoaderData() as { splat: string };
                return (
                  <div>
                    API Catchall Page - Splat: {data.splat} | Params:{" "}
                    {params["*"]}
                  </div>
                );
              },
              loader: (args: LoaderFunctionArgs) =>
                Promise.resolve({ splat: args.params["*"] || "" }),
            }),
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
    });

    const res = await server.request("http://localhost/api/foo/bar/baz");
    assertEquals(res.status, 200);
    assertEquals(
      res.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(
      html,
      "API Catchall Page - Splat: <!-- -->foo/bar/baz<!-- --> | Params:<!-- --> <!-- -->foo/bar/baz",
    );
  });

  it("should forward action headers to the HTML response", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => <Outlet /> },
      children: [
        {
          path: "test",
          main: () =>
            Promise.resolve({
              default: function ActionTestPage() {
                const data = useLoaderData() as { message: string };
                return <div>Action Test Page - {data.message}</div>;
              },
              loader: () => Promise.resolve({ message: "loaded" }),
              action: () =>
                Promise.resolve(
                  new Response(JSON.stringify({ success: true }), {
                    headers: new Headers([["X-Action", "processed"]]),
                  }),
                ),
            }),
        },
      ],
    });

    const server = createServer(import.meta.url, client, { path: "/" });
    const res = await server.request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "test=data",
    });
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("x-action"), "processed");
    const html = await res.text();
    assertStringIncludes(
      html,
      "Action Test Page - <!-- -->loaded",
    );
  });

  it("should forward both loader and action headers to the HTML response", async () => {
    const client = new Client({
      path: "/",
      main: { default: () => <Outlet /> },
      children: [
        {
          path: "test",
          main: () =>
            Promise.resolve({
              default: function HeadersTestPage() {
                return <div>Headers Test Page</div>;
              },
              loader: () =>
                Promise.resolve(
                  new Response(null, {
                    headers: new Headers([["X-Loader", "loaded"]]),
                  }),
                ),
              action: () =>
                Promise.resolve(
                  new Response(null, {
                    headers: new Headers([["X-Action", "processed"]]),
                  }),
                ),
            }),
        },
      ],
    });

    const server = createServer(import.meta.url, client, { path: "/" });

    const getRes = await server.request("http://localhost/test");
    assertEquals(getRes.status, 200);
    assertEquals(getRes.headers.get("x-loader"), "loaded");
    assertEquals(getRes.headers.get("x-action"), null);
    const getHtml = await getRes.text();
    assertStringIncludes(getHtml, "<div>Headers Test Page</div>");

    const postRes = await server.request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "test=data",
    });
    assertEquals(postRes.status, 200);
    assertEquals(postRes.headers.get("x-loader"), "loaded");
    assertEquals(postRes.headers.get("x-action"), "processed");
    const postHtml = await postRes.text();
    assertStringIncludes(postHtml, "<div>Headers Test Page</div>");
  });

  it("should handle errors with error boundaries", async () => {
    const client = new Client({
      path: "/",
      main: {
        default: () => <div>Home</div>,
        ErrorBoundary: () => <div>Error occurred</div>,
        loader: () => Promise.reject(new Error("Test error")),
      },
    });

    const server = createServer(import.meta.url, client, { path: "/" });
    const res = await server.request("http://localhost/");
    assertEquals(res.status, 200);
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "<div>Error occurred</div>");
  });

  it("should handle unhandled errors that cannot be caught by error boundaries", async () => {
    const client = new Client({
      path: "/",
      main: {
        default: function ThrowingComponent() {
          throw new Error("Unhandled error");
        },
      },
    });

    const server = createServer(import.meta.url, client, { path: "/" });
    const res = await server.request("http://localhost/");
    assertEquals(res.status, 500);
    assertEquals(res.headers.get("content-type"), "application/problem+json");
    const error = await res.json();
    assertEquals(Object.keys(error), ["status", "title"]);
    assertObjectMatch(error, {
      status: 500,
      title: "InternalServerError",
    });
  });
});

describe("serializeErrorDefault", () => {
  it("should pass through non-Error values unchanged", () => {
    const value = { foo: "bar" };
    const result = serializeErrorDefault(value);
    assertEquals(result, value);
  });

  it(
    "should serialize generic Error with message and stack in development",
    simulateEnvironment({ "APP_ENV": null }, () => {
      const err = new Error("Oops");
      const result = serializeErrorDefault(err) as Record<string, unknown>;
      assertEquals(result.__type, "Error");
      assertEquals(result.message, "Oops");
      assertEquals(typeof result.stack, "string");
      assertEquals(result.__subType, undefined);
    }),
  );

  it(
    "should omit stack outside development",
    simulateEnvironment({ "APP_ENV": "production" }, () => {
      const err = new Error("No stack");
      const result = serializeErrorDefault(err) as Record<string, unknown>;
      assertEquals(result.__type, "Error");
      assertEquals(result.message, "No stack");
      assertEquals(result.stack, undefined);
    }),
  );

  it("should set __subType for Error subclasses", () => {
    const err = new TypeError("Wrong type");
    const result = serializeErrorDefault(err) as Record<string, unknown>;
    assertEquals(result.__type, "Error");
    assertEquals(result.__subType, "TypeError");
    assertEquals(result.message, "Wrong type");
  });

  it("should serialize HttpError with RFC7807 fields", () => {
    const err = new HttpError(400, "Bad request");
    const result = serializeErrorDefault(err) as Record<string, unknown>;
    assertEquals(result.__type, "Error");
    assertEquals(result.__subType, "HttpError");
    assertEquals(result.status, 400);
    const detailOrMessage = (result as Record<string, unknown>)["detail"] ??
      result.message;
    assertEquals(detailOrMessage, "Bad request");
  });
});
