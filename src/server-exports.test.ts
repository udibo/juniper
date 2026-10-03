import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import * as path from "@std/path";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import type { Hono } from "hono";
import { RouterContextProvider } from "react-router";

import { HttpError } from "@udibo/juniper";
import { Builder } from "@udibo/juniper/build";
import { Client } from "@udibo/juniper/client";
import "@udibo/juniper/server";

import { observeChildProcesses } from "./utils/_testing-processes.ts";

const declarations = [
  [
    "function",
    "export function loader(args: Parameters<typeof read>[0]) { return read(args); } export async function action(args: Parameters<typeof write>[0]) { return await write(args); }",
  ],
  ["const", "export const loader = read; export const action = write;"],
  [
    "local",
    "const loader = read; const action = write; export { loader, action };",
  ],
  [
    "alias",
    "const load = read; const submit = write; export { load as loader, submit as action };",
  ],
  [
    "reexport",
    "export { read as loader, write as action } from '../../../handlers.ts';",
  ],
  [
    "import-alias",
    "import { read as load, write as submit } from '../../../handlers.ts'; export { load as loader, submit as action };",
  ],
  [
    "default-reexport",
    "export { default as loader, write as action } from '../../../handlers.ts';",
  ],
  [
    "destructured",
    "export const { loader, action } = { loader: read, action: write };",
  ],
  ["let", "export let loader = read; export let action = write;"],
  [
    "merged-namespace",
    "export function loader(args: Parameters<typeof read>[0]) { return read(args); } export namespace loader { export type Result = string; } export function action(args: Parameters<typeof write>[0]) { return write(args); } export namespace action { export type Result = string; }",
  ],
] as const;

const absent = [
  [
    "comment",
    "// export function loader() {}\n/* export const action = () => 1; */",
  ],
  [
    "string",
    "export const example = 'export function loader() {} export const action = () => 1;';",
  ],
  [
    "types",
    "export type loader = () => void; export interface action { value: string; }",
  ],
  [
    "local-types",
    "type loader = () => void; interface action { value: string; } export { loader, action };",
  ],
  [
    "import-types",
    "import type { read as loader, write as action } from '../../../handlers.ts'; export { loader, action };",
  ],
  [
    "reexport-types",
    "export type { read as loader, write as action } from '../../../handlers.ts';",
  ],
  [
    "mixed-types",
    "export { type read as loader, type write as action } from '../../../handlers.ts';",
  ],
  [
    "ambient",
    "export declare const loader: () => void; export declare function action(): void;",
  ],
  [
    "namespace-types",
    "export namespace loader { export type Result = string; } export namespace action { export interface Result { value: string; } }",
  ],
  [
    "unrelated",
    "export function helper(loader: string, action: string) { return loader + action; }",
  ],
] as const;

const mixed = [
  [
    "mixed",
    "export { read as loader, type write as action } from '../../../handlers.ts';",
    "loader",
  ],
  [
    "mixed-local",
    "import { type read as loader, write as action } from '../../../handlers.ts'; export { loader, action };",
    "action",
  ],
] as const;

interface Fixture extends AsyncDisposable {
  client: Client;
  server: Hono;
  origin: string;
  projectRoot: string;
  imports: string[];
  clientSource: string;
}

async function createFixture(): Promise<Fixture> {
  const projectRoot = await Deno.makeTempDir({
    dir: path.dirname(path.fromFileUrl(import.meta.url)),
    prefix: "_server-exports-",
  });
  let listener: Deno.HttpServer | undefined;
  try {
    await Deno.writeTextFile(
      path.join(projectRoot, ".babelrc"),
      JSON.stringify({
        plugins: ["this-fixture-plugin-must-not-be-loaded"],
      }),
    );
    await Deno.writeTextFile(
      path.join(projectRoot, "state.ts"),
      `
import { createContext } from "react-router";
export const requestContext = createContext<string>("unset");
export const imports: string[] = [];
`,
    );
    await Deno.writeTextFile(
      path.join(projectRoot, "handlers.ts"),
      `
import { HttpError } from "@udibo/juniper";
import type { RouteActionArgs, RouteLoaderArgs } from "@udibo/juniper";
import { requestContext } from "./state.ts";
export function read({ request, params, context }: RouteLoaderArgs<{ id: string }>) {
  if (new URL(request.url).searchParams.has("refuse")) throw new HttpError(403, "Fixture refused");
  return { method: request.method, id: params.id, query: new URL(request.url).search, context: context.get(requestContext), routeId: request.headers.get("X-Juniper-Route-Id") };
}
export async function write(args: RouteActionArgs<{ id: string }>) {
  return { ...read(args), field: (await args.request.formData()).get("field") };
}
export default read;
`,
    );
    const routes = path.join(projectRoot, "routes");
    const directory = path.join(routes, "group", "[id]");
    await Deno.mkdir(directory, { recursive: true });
    await Deno.writeTextFile(
      path.join(routes, "main.ts"),
      `
import { Hono } from "hono";
import { requestContext } from "../state.ts";
const app = new Hono();
app.use(async (c, next) => { c.get("context").set(requestContext, "owned-server-context"); await next(); });
export default app;
`,
    );
    await Deno.writeTextFile(
      path.join(routes, "main.tsx"),
      `
import { createElement } from "react";
import { Outlet } from "react-router";
export default function Main() { return createElement(Outlet); }
`,
    );
    const page = `
import { createElement } from "react";
import type { RouteProps } from "@udibo/juniper";
export default function Page({ loaderData }: RouteProps<{ id: string }, { context: string }>) { return createElement("p", null, loaderData?.context ?? "no-data"); }
`;
    const bridge = `
import type { RouteActionArgs, RouteLoaderArgs } from "@udibo/juniper";
export const loader = ({ serverLoader }: RouteLoaderArgs<{ id: string }>) => serverLoader();
export const action = ({ serverAction }: RouteActionArgs<{ id: string }>) => serverAction();
`;
    for (const [name, source] of [...declarations, ...absent]) {
      await Deno.writeTextFile(
        path.join(directory, `${name}.tsx`),
        page + (declarations.some(([value]) => value === name) ? bridge : ""),
      );
      await Deno.writeTextFile(
        path.join(directory, `${name}.ts`),
        `
import { read, write } from "../../../handlers.ts";
import { imports } from "../../../state.ts";
imports.push(${JSON.stringify(name)});
${source}
`,
      );
    }
    await Deno.writeTextFile(path.join(directory, "missing.tsx"), page);
    for (const [name, source] of mixed) {
      await Deno.writeTextFile(path.join(directory, `${name}.tsx`), page);
      await Deno.writeTextFile(path.join(directory, `${name}.ts`), source);
    }
    const { imports } = await import(
      path.toFileUrl(path.join(projectRoot, "state.ts")).href
    );
    await using builder = new Builder({ projectRoot });
    await builder.buildMainServerEntrypoint();
    await builder.buildMainClientEntrypoint();
    assertEquals(imports, [], "generation must not evaluate server modules");
    const { server } = await import(path.toFileUrl(builder.serverPath).href);
    const { client } = await import(path.toFileUrl(builder.clientPath).href);
    assertInstanceOf(client, Client);
    listener = Deno.serve(
      { hostname: "127.0.0.1", port: 0, onListen() {} },
      server.fetch,
    );
    const address = listener.addr;
    assert(address.transport === "tcp");
    const origin = `http://127.0.0.1:${address.port}`;
    const clientSource = await Deno.readTextFile(builder.clientPath);
    return {
      client,
      server,
      origin,
      projectRoot,
      imports,
      clientSource,
      async [Symbol.asyncDispose]() {
        await listener!.shutdown();
        await listener!.finished;
        await Deno.remove(projectRoot, { recursive: true });
      },
    };
  } catch (error) {
    if (listener) {
      await listener.shutdown();
      await listener.finished;
    }
    await Deno.remove(projectRoot, { recursive: true });
    throw error;
  }
}

const idFor = (name: string) => `/group/[id]/${name}`;
const pathnameFor = (name: string) => `/group/item/${name}?value=yes`;

function routeArgs(request: Request, pattern: string) {
  return {
    request,
    url: new URL(request.url),
    pattern: pattern.replace("[id]", ":id"),
    params: { id: "item" },
    context: new RouterContextProvider(),
  };
}

describe("generated server value exports", () => {
  const spawnedProcesses = observeChildProcesses();
  let fixture: Fixture;
  beforeAll(async () => {
    fixture = await createFixture();
  });
  afterAll(async () => {
    try {
      if (fixture) await fixture[Symbol.asyncDispose]();
    } finally {
      await spawnedProcesses[Symbol.asyncDispose]();
    }
  });

  for (const [name] of declarations) {
    it(`executes actual ${name} server exports for document, data, and action requests`, async () => {
      const namespace = await import(
        path.toFileUrl(
          path.join(
            fixture.projectRoot,
            "routes",
            "group",
            "[id]",
            `${name}.ts`,
          ),
        ).href
      );
      assertEquals(typeof namespace.loader, "function");
      assertEquals(typeof namespace.action, "function");
      const url = fixture.origin + pathnameFor(name);
      for (
        const [headers, method] of [
          [{}, "GET"],
          [{ "X-Juniper-Route-Id": idFor(name) }, "GET"],
          [{
            "X-Juniper-Route-Id": idFor(name),
            "Content-Type": "application/x-www-form-urlencoded",
          }, "POST"],
        ] as const
      ) {
        const response = await fixture.server.request(url, {
          headers,
          method,
          ...(method === "POST" ? { body: "field=owned-body" } : {}),
        });
        assertEquals(response.status, 200);
        assertStringIncludes(await response.text(), "owned-server-context");
      }
    });

    for (const handler of ["loader", "action"] as const) {
      it(`bridges the generated ${name} ${handler} to the actual server`, async () => {
        const id = idFor(name);
        await fixture.client.loadLazyMatches([{ id }]);
        const route = fixture.client.routeObjectMap.get(id);
        const execute = route?.[handler];
        assert(typeof execute === "function");
        const request = new Request(
          fixture.origin + pathnameFor(name),
          handler === "action"
            ? {
              method: "POST",
              body: new URLSearchParams({ field: "owned-body" }),
            }
            : {},
        );
        assertEquals(await execute(routeArgs(request, id)), {
          method: handler === "loader" ? "GET" : "POST",
          id: "item",
          query: "?value=yes",
          context: "owned-server-context",
          routeId: id,
          ...(handler === "action" ? { field: "owned-body" } : {}),
        });
        const group = fixture.client.rootRoute.children?.find((entry) =>
          entry.path === "group"
        );
        const dynamic = group?.children?.find((entry) => entry.path === ":id");
        assertEquals(
          dynamic?.children?.find((entry) => entry.path === name)?.server,
          { loader: true, action: true },
        );
      });
    }
  }

  for (const [name] of absent) {
    it(`omits ${name} handler flags and adapters`, async () => {
      const namespace = await import(
        path.toFileUrl(
          path.join(
            fixture.projectRoot,
            "routes",
            "group",
            "[id]",
            `${name}.ts`,
          ),
        ).href
      );
      assertEquals(namespace.loader, undefined);
      assertEquals(namespace.action, undefined);
      const id = idFor(name);
      await fixture.client.loadLazyMatches([{ id }]);
      const route = fixture.client.routeObjectMap.get(id);
      assertEquals(route?.loader, undefined);
      assertEquals(route?.action, undefined);
      const group = fixture.client.rootRoute.children?.find((entry) =>
        entry.path === "group"
      );
      const dynamic = group?.children?.find((entry) => entry.path === ":id");
      assertEquals(
        dynamic?.children?.find((entry) => entry.path === name)?.server,
        undefined,
      );
    });
  }

  it("keeps a missing server sibling valid", async () => {
    const id = idFor("missing");
    await fixture.client.loadLazyMatches([{ id }]);
    assertEquals(fixture.client.routeObjectMap.get(id)?.loader, undefined);
    assertEquals(fixture.client.routeObjectMap.get(id)?.action, undefined);
  });

  for (const [name, , handler] of mixed) {
    it(`detects only the value in ${name} type and value exports`, async () => {
      const namespace = await import(
        path.toFileUrl(
          path.join(
            fixture.projectRoot,
            "routes",
            "group",
            "[id]",
            `${name}.ts`,
          ),
        ).href
      );
      const other = handler === "loader" ? "action" : "loader";
      assertEquals(typeof namespace[handler], "function");
      assertEquals(namespace[other], undefined);
      const id = idFor(name);
      await fixture.client.loadLazyMatches([{ id }]);
      const route = fixture.client.routeObjectMap.get(id);
      const execute = route?.[handler];
      assert(typeof execute === "function");
      assertEquals(route?.[other], undefined);
      const request = new Request(
        fixture.origin + pathnameFor(name),
        handler === "action"
          ? {
            method: "POST",
            body: new URLSearchParams({ field: "owned-body" }),
          }
          : {},
      );
      assertEquals(await execute(routeArgs(request, id)), {
        method: handler === "loader" ? "GET" : "POST",
        id: "item",
        query: "?value=yes",
        context: "owned-server-context",
        routeId: id,
        ...(handler === "action" ? { field: "owned-body" } : {}),
      });
    });
  }

  it("preserves server refusals through the generated alias loader bridge", async () => {
    const id = idFor("alias");
    await fixture.client.loadLazyMatches([{ id }]);
    const loader = fixture.client.routeObjectMap.get(id)?.loader;
    assert(typeof loader === "function");
    const error = await assertRejects(async () =>
      await loader(
        routeArgs(
          new Request(fixture.origin + pathnameFor("alias") + "&refuse=yes"),
          id,
        ),
      )
    );
    assertInstanceOf(error, HttpError);
    assertEquals(error.status, 403);
  });

  it("keeps server module imports out of the generated client artifact", () => {
    assertEquals(fixture.clientSource.includes("handlers.ts"), false);
    assertEquals(fixture.clientSource.includes("state.ts"), false);
    assertEquals(
      /import\([^)]*\/[^)]*(?<!x)\.ts["']\)/.test(fixture.clientSource),
      false,
    );
  });
});
