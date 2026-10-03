import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertStringIncludes,
} from "@std/assert";
import * as path from "@std/path";
import { afterAll, describe, it } from "@std/testing/bdd";
import { stub } from "@std/testing/mock";
import type { Hono } from "hono";

import { Builder } from "@udibo/juniper/build";
import { Client } from "@udibo/juniper/client";
import "@udibo/juniper/server";

import { observeChildProcesses } from "./utils/_testing-processes.ts";

const spawnedProcesses = observeChildProcesses();

interface Fixture extends AsyncDisposable {
  server: Hono;
  client: Client;
  calls: string[];
  serverSource: string;
}

async function createFixture(
  routes: Record<string, string>,
): Promise<Fixture> {
  const projectRoot = await Deno.makeTempDir({
    dir: path.dirname(path.fromFileUrl(import.meta.url)),
    prefix: "_route-precedence-",
  });
  try {
    const callsPath = path.join(projectRoot, "calls.ts");
    await Deno.writeTextFile(callsPath, "export const calls: string[] = [];\n");
    for (const [name, source] of Object.entries(routes)) {
      const file = path.join(projectRoot, "routes", name);
      await Deno.mkdir(path.dirname(file), { recursive: true });
      await Deno.writeTextFile(
        file,
        `import { calls } from ${
          JSON.stringify(path.toFileUrl(callsPath).href)
        };\n${source}`,
      );
    }
    await using builder = new Builder({ projectRoot });
    await builder.buildMainServerEntrypoint();
    await builder.buildMainClientEntrypoint();
    const { server } = await import(path.toFileUrl(builder.serverPath).href);
    const { client } = await import(path.toFileUrl(builder.clientPath).href);
    assertInstanceOf(client, Client);
    const { calls } = await import(path.toFileUrl(callsPath).href);
    return {
      server,
      client,
      calls,
      serverSource: await Deno.readTextFile(builder.serverPath),
      async [Symbol.asyncDispose]() {
        await Deno.remove(projectRoot, { recursive: true });
      },
    };
  } catch (error) {
    await Deno.remove(projectRoot, { recursive: true });
    throw error;
  }
}

const layout = `
import { createElement } from "react";
import { Outlet } from "react-router";
export default function Main() { return createElement(Outlet); }
export function ErrorBoundary() { return createElement("p", null, "Denied"); }
`;

const page = `
import { createElement } from "react";
import type { RouteProps } from "@udibo/juniper";
export default function Page({ loaderData }: RouteProps<Record<string, string>, { value: string }>) {
  return createElement("p", null, loaderData?.value ?? "page");
}
`;

const denied = `
import { Hono } from "hono";
import { HttpError } from "@udibo/juniper";
const app = new Hono();
app.use(() => { calls.push("deny"); throw new HttpError(403, "Denied"); });
export default app;
export function loader() { calls.push("loader"); return { value: "private-loader" }; }
export function action() { calls.push("action"); return { value: "private-action" }; }
`;

const dynamic = `
import { Hono } from "hono";
import type { RouteLoaderArgs } from "@udibo/juniper";
const app = new Hono();
app.use(async (_c, next) => { calls.push("dynamic"); await next(); });
export default app;
export function loader({ params }: RouteLoaderArgs<{ id: string }>) {
  calls.push("dynamic-loader"); return { value: "dynamic-" + params.id };
}
`;

async function request(
  fixture: Fixture,
  pathname: string,
  routeId?: string,
  action = false,
) {
  fixture.calls.length = 0;
  const response = await fixture.server.request(`http://localhost${pathname}`, {
    method: action ? "POST" : "GET",
    headers: {
      ...(routeId ? { "X-Juniper-Route-Id": routeId } : {}),
      ...(action
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    ...(action ? { body: "fixture=yes" } : {}),
  });
  return {
    status: response.status,
    body: await response.text(),
    calls: [...fixture.calls],
  };
}

describe("generated route precedence", () => {
  afterAll(async () => {
    await spawnedProcesses[Symbol.asyncDispose]();
  });

  it("runs named-route denial before loaders and actions beside dynamic files", async () => {
    using _errors = stub(console, "error");
    await using fixture = await createFixture({
      "main.tsx": layout,
      "new.ts": denied,
      "new.tsx": page,
      "[id].ts": dynamic,
      "[id].tsx": page,
      "index.tsx": `export default function Index() { return "index"; }`,
      "docs/[...].tsx":
        `export default function Catchall() { return "catchall"; }`,
      "group/new.ts": denied,
      "group/new.tsx": page,
      "group/[id].ts": dynamic,
      "group/[id].tsx": page,
    });
    for (const base of ["", "/group"]) {
      const pathname = `${base}/new`;
      const results = [
        await request(fixture, pathname),
        await request(fixture, pathname, pathname),
        await request(fixture, pathname, pathname, true),
      ];
      assertEquals(
        results.map(({ status, calls }) => ({ status, calls })),
        Array.from({ length: 3 }, () => ({ status: 403, calls: ["deny"] })),
      );
      for (const result of results) {
        assertEquals(result.body.includes("private-loader"), false);
        assertEquals(result.body.includes("private-action"), false);
      }
      const dynamicResult = await request(fixture, `${base}/123`);
      assertEquals(dynamicResult.status, 200);
      assertEquals(dynamicResult.calls, ["dynamic", "dynamic-loader"]);
      assertStringIncludes(dynamicResult.body, "dynamic-123");
    }
    const index = await request(fixture, "/");
    assertEquals(index.status, 200);
    assertEquals(index.calls, []);
    assertStringIncludes(index.body, "index");
    const catchall = await request(fixture, "/docs/unmatched/deep");
    assertEquals(catchall.status, 200);
    assertStringIncludes(catchall.body, "catchall");
    assertEquals(catchall.calls, []);
    assertEquals(
      fixture.client.rootRoute.children?.map((route) => route.path),
      [
        "docs",
        "group",
        "new",
        ":id",
      ],
    );
    assertStringIncludes(fixture.serverSource, 'path: "docs"');
    assertStringIncludes(fixture.serverSource, 'path: ":id"');
    assert(
      fixture.serverSource.indexOf('path: "docs"') <
        fixture.serverSource.indexOf('path: ":id"'),
    );
    assertEquals(
      [...fixture.client.routeFileMap.keys()].sort(),
      [
        "/",
        "/[id]",
        "/docs/[...]",
        "/group/[id]",
        "/group/new",
        "/index",
        "/new",
      ].sort(),
    );
  });

  it("dispatches named API files and directories before parameterized siblings", async () => {
    using _errors = stub(console, "error");
    const dynamicApi = `
import { Hono } from "hono";
const app = new Hono();
app.use(async (_c, next) => { calls.push("dynamic"); await next(); });
app.get("/", (c) => c.text("dynamic-" + c.req.param("id")));
export default app;
`;
    await using fixture = await createFixture({
      "new.ts": denied,
      "[id]/main.ts": dynamicApi,
      "group/new/index.ts": denied,
      "group/[id]/main.ts": dynamicApi,
      "docs/[...].ts": `
import { Hono } from "hono";
const app = new Hono();
app.get("*", (c) => c.text("catchall"));
export default app;
`,
    });
    for (const base of ["", "/group"]) {
      const result = await request(fixture, `${base}/new`);
      assertEquals({ status: result.status, calls: result.calls }, {
        status: 403,
        calls: ["deny"],
      });
      const dynamicResult = await request(fixture, `${base}/123`);
      assertEquals(dynamicResult.status, 200);
      assertEquals(dynamicResult.calls, ["dynamic"]);
      assertEquals(dynamicResult.body, "dynamic-123");
    }
    const catchall = await request(fixture, "/docs/unmatched/deep");
    assertEquals(catchall.status, 200);
    assertEquals(catchall.body, "catchall");
    assertEquals(catchall.calls, []);
    assertStringIncludes(fixture.serverSource, 'path: "docs"');
    assertStringIncludes(fixture.serverSource, 'path: ":id"');
    assert(
      fixture.serverSource.indexOf('path: "docs"') <
        fixture.serverSource.indexOf('path: ":id"'),
    );
  });

  it("keeps client-only named routes ahead of server-only dynamic middleware", async () => {
    await using fixture = await createFixture({
      "main.tsx": layout,
      "new.tsx": `${page}
export function loader() { calls.push("public-loader"); return { value: "public" }; }
export function action() { calls.push("public-action"); return { value: "public-action" }; }
`,
      "[id].ts": dynamic,
      "group/new.tsx": `${page}
export function loader() { calls.push("public-loader"); return { value: "public" }; }
export function action() { calls.push("public-action"); return { value: "public-action" }; }
`,
      "group/[id].ts": dynamic,
    });
    for (const base of ["", "/group"]) {
      const pathname = `${base}/new`;
      const results = [
        await request(fixture, pathname),
        await request(fixture, pathname, pathname),
        await request(fixture, pathname, pathname, true),
      ];
      assertEquals(
        results.map(({ status, calls }) => ({ status, calls })),
        [
          { status: 200, calls: ["public-loader"] },
          { status: 200, calls: ["public-loader"] },
          { status: 200, calls: ["public-action"] },
        ],
      );
    }
  });
});
