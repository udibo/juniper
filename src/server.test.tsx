import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Outlet, useLoaderData, useParams } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import type { RouteLoaderArgs } from "./mod.ts";
import { Client } from "./client.tsx";
import { createServer } from "./server.tsx";

import { mergeServerRoutes } from "./_server.tsx";
import { cborDecode } from "./_serialization.ts";

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

    const { Hono } = await import("hono");
    const testApp = new Hono<{ Variables: { test: string } }>();
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
      },
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      main: {
        loader: () =>
          Promise.resolve(
            new Response(null, {
              headers: new Headers([["X-Loader", "yes"]]),
            }),
          ),
      },
    });
    const res = await server.request("http://localhost/");
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("x-loader"), "yes");
    const html = await res.text();
    assertStringIncludes(html, "<div>Home</div>");
  });

  it("should return CBOR for data requests when X-Juniper-Route-Id is present", async () => {
    const client = new Client({
      path: "/",
      main: {
        default: () => <div>Home</div>,
      },
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      main: {
        loader: () => Promise.resolve({ ok: true }),
      },
    });
    const res = await server.request("http://localhost/", {
      headers: { "X-Juniper-Route-Id": "/" },
    });
    assertEquals(res.status, 200);
    const ct = res.headers.get("content-type");
    assertEquals(ct, "application/cbor");
    const buffer = await res.arrayBuffer();
    const data = cborDecode<{ ok: boolean }>(new Uint8Array(buffer));
    assertEquals(data, { ok: true });
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
            }),
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      children: [
        {
          path: "blog",
          index: {
            loader: () => Promise.resolve({ posts: [] }),
          },
        },
      ],
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
                }),
            },
          ],
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      children: [
        {
          path: "blog",
          children: [
            {
              path: ":id",
              main: {
                loader: (args: RouteLoaderArgs) =>
                  Promise.resolve({ postId: args.params.id }),
              },
            },
          ],
        },
      ],
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
            }),
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      children: [
        {
          path: "api",
          catchall: {
            loader: (args: RouteLoaderArgs) =>
              Promise.resolve({ splat: args.params["*"] || "" }),
          },
        },
      ],
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
            }),
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      children: [
        {
          path: "test",
          main: {
            loader: () => Promise.resolve({ message: "loaded" }),
            action: () =>
              Promise.resolve(
                new Response(JSON.stringify({ success: true }), {
                  headers: new Headers([["X-Action", "processed"]]),
                }),
              ),
          },
        },
      ],
    });
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
            }),
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      children: [
        {
          path: "test",
          main: {
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
          },
        },
      ],
    });

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
      },
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      main: {
        loader: () => Promise.reject(new Error("Test error")),
      },
    });
    const res = await server.request("http://localhost/");
    assertEquals(res.status, 500);
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "<div>Error occurred</div>");
  });

  it("should handle unhandled errors with React Router's default ErrorBoundary", async () => {
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
    assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
  });

  it("should use nested error boundary for 404s within nested routes", async () => {
    const client = new Client({
      path: "/",
      main: {
        default: () => <Outlet />,
        ErrorBoundary: () => <div>Root Error Boundary</div>,
      },
      children: [
        {
          path: "admin",
          main: {
            default: () => <Outlet />,
            ErrorBoundary: () => <div>Admin Error Boundary</div>,
          },
          children: [
            {
              path: "users",
              main: () => Promise.resolve({ default: () => <div>Users</div> }),
            },
          ],
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      children: [
        {
          path: "admin",
          children: [
            {
              path: "users",
            },
          ],
        },
      ],
    });

    // Request to a non-existent path under /admin should use admin's error boundary
    const res = await server.request("http://localhost/admin/non-existent");
    assertEquals(res.status, 404);
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "<div>Admin Error Boundary</div>");
    // Should NOT use root error boundary
    assertEquals(html.includes("Root Error Boundary"), false);
  });

  it("should use root error boundary for 404s at root level", async () => {
    const client = new Client({
      path: "/",
      main: {
        default: () => <Outlet />,
        ErrorBoundary: () => <div>Root Error Boundary</div>,
      },
      children: [
        {
          path: "admin",
          main: {
            default: () => <Outlet />,
            ErrorBoundary: () => <div>Admin Error Boundary</div>,
          },
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      children: [
        {
          path: "admin",
        },
      ],
    });

    // Request to a non-existent path at root level should use root's error boundary
    const res = await server.request("http://localhost/non-existent");
    assertEquals(res.status, 404);
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "<div>Root Error Boundary</div>");
    // Should NOT use admin error boundary
    assertEquals(html.includes("Admin Error Boundary"), false);
  });

  it("should find nearest ancestor error boundary when route has no error boundary", async () => {
    const client = new Client({
      path: "/",
      main: {
        default: () => <Outlet />,
        ErrorBoundary: () => <div>Root Error Boundary</div>,
      },
      children: [
        {
          path: "admin",
          main: {
            default: () => <Outlet />,
            ErrorBoundary: () => <div>Admin Error Boundary</div>,
          },
          children: [
            {
              path: "settings",
              // No error boundary on settings
              main: {
                default: () => <Outlet />,
              },
              children: [
                {
                  path: "profile",
                  main: () =>
                    Promise.resolve({ default: () => <div>Profile</div> }),
                },
              ],
            },
          ],
        },
      ],
    });

    const server = createServer(import.meta.url, client, {
      path: "/",
      children: [
        {
          path: "admin",
          children: [
            {
              path: "settings",
              children: [
                {
                  path: "profile",
                },
              ],
            },
          ],
        },
      ],
    });

    // Request to non-existent path under /admin/settings should bubble up to admin's error boundary
    const res = await server.request(
      "http://localhost/admin/settings/non-existent",
    );
    assertEquals(res.status, 404);
    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "<div>Admin Error Boundary</div>");
  });
});

describe("mergeServerRoutes", () => {
  it("should use matching child server routes for index and catchall", async () => {
    const serverRoute = {
      path: "/",
      children: [
        {
          path: "/",
          index: {
            loader: () => Promise.resolve({ source: "server-child-index" }),
          },
        },
        {
          path: "*",
          catchall: {
            loader: () => Promise.resolve({ source: "server-child-catchall" }),
          },
        },
      ],
    };

    const clientRoutes = [
      {
        path: "/",
        children: [{ index: true }, { path: "*" }],
      },
    ];

    const [rootRoute] = mergeServerRoutes(serverRoute, clientRoutes);
    const createArgs = (url: string) => ({
      context: {} as never,
      params: {},
      request: new Request(url),
    } as unknown as LoaderFunctionArgs);

    const indexRoute = rootRoute.children?.find((route) =>
      route.index === true
    );
    assertExists(indexRoute);
    const indexLoader = typeof indexRoute.loader === "function"
      ? indexRoute.loader
      : undefined;
    assertExists(indexLoader);
    const indexResult = await indexLoader(createArgs("http://localhost/"));
    assertEquals(indexResult, { source: "server-child-index" });

    const catchallRoute = rootRoute.children?.find((route) =>
      route.path === "*"
    );
    assertExists(catchallRoute);
    const catchallLoader = typeof catchallRoute.loader === "function"
      ? catchallRoute.loader
      : undefined;
    assertExists(catchallLoader);
    const catchallResult = await catchallLoader(
      createArgs("http://localhost/any"),
    );
    assertEquals(catchallResult, { source: "server-child-catchall" });
  });
});

describe("build artifact cache control", () => {
  it("should set no-cache headers with etag for /build/main.js", async () => {
    // Create a minimal public/build directory structure for serving
    const tempDir = await Deno.makeTempDir();
    try {
      const buildDir = `${tempDir}/public/build`;
      await Deno.mkdir(buildDir, { recursive: true });
      await Deno.writeTextFile(`${buildDir}/main.js`, "console.log('test');");

      const client = new Client({
        path: "/",
        main: { default: () => <div>Home</div> },
      });

      const server = createServer(`file://${tempDir}/server.ts`, client, {
        path: "/",
      });

      const res = await server.request("http://localhost/build/main.js");
      assertEquals(res.status, 200);
      assertEquals(
        res.headers.get("Cache-Control"),
        "private, no-cache, must-revalidate, max-age=0",
      );
      assertExists(res.headers.get("ETag"));
      await res.body?.cancel();
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });

  it("should set long cache headers for other /build/* files", async () => {
    const tempDir = await Deno.makeTempDir();
    try {
      const buildDir = `${tempDir}/public/build`;
      await Deno.mkdir(buildDir, { recursive: true });
      await Deno.writeTextFile(
        `${buildDir}/chunk-abc123.js`,
        "export const x = 1;",
      );

      const client = new Client({
        path: "/",
        main: { default: () => <div>Home</div> },
      });

      const server = createServer(`file://${tempDir}/server.ts`, client, {
        path: "/",
      });

      const res = await server.request(
        "http://localhost/build/chunk-abc123.js",
      );
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("Cache-Control"), "public, max-age=14400");
      assertEquals(res.headers.get("ETag"), null);
      await res.body?.cancel();
    } finally {
      await Deno.remove(tempDir, { recursive: true });
    }
  });
});
