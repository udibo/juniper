import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createMemoryRouter, Outlet } from "react-router";
import type { ShouldRevalidateFunction } from "react-router";

import { Client } from "@udibo/juniper/client";
import type { RootClientRoute } from "@udibo/juniper/client";
import type { RouteModule } from "@udibo/juniper";

import { createLazyRoute, createRoute } from "./_client.tsx";

const keepLoaderData: ShouldRevalidateFunction = () => false;

function countingRoute(
  shouldRevalidate?: ShouldRevalidateFunction,
): { module: RouteModule; loads: () => number } {
  let loads = 0;
  return {
    module: {
      default: () => <Outlet />,
      loader: () => ({ load: ++loads }),
      ...(shouldRevalidate ? { shouldRevalidate } : {}),
    },
    loads: () => loads,
  };
}

async function startRouter(
  client: Client,
  path: string,
): Promise<ReturnType<typeof createMemoryRouter>> {
  const router = createMemoryRouter(client.routeObjects, {
    initialEntries: [path],
  });
  if (!router.state.initialized) {
    await new Promise<void>((resolve) => {
      const unsubscribe = router.subscribe((state) => {
        if (!state.initialized) return;
        unsubscribe();
        resolve();
      });
    });
  }
  return router;
}

async function loadsAfterSearchChange(
  client: Client,
  path: string,
  loads: () => number,
): Promise<number> {
  const router = await startRouter(client, path);
  try {
    assertEquals(loads(), 1);
    await router.navigate(`${path}?page=2`);
    assertEquals(router.state.location.search, "?page=2");
    return loads();
  } finally {
    router.dispose();
  }
}

const skipSearchOnlyChanges: ShouldRevalidateFunction = (
  { currentUrl, nextUrl, formMethod, defaultShouldRevalidate },
) => {
  const searchOnly = currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search;
  if (!formMethod && searchOnly) return false;
  return defaultShouldRevalidate;
};

const skipSamePathname: ShouldRevalidateFunction = (
  { currentUrl, nextUrl, defaultShouldRevalidate },
) => {
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
};

async function loadsAcrossChanges(
  shouldRevalidate: ShouldRevalidateFunction,
): Promise<{ search: number; action: number; revalidate: number }> {
  const { module, loads } = countingRoute(shouldRevalidate);
  const client = new Client({
    path: "/",
    main: { ...module, action: () => ({ saved: true }) },
  });
  const router = await startRouter(client, "/");
  try {
    assertEquals(loads(), 1);
    await router.navigate("/?page=2");
    const search = loads();
    await router.navigate("/?page=3", {
      formMethod: "post",
      formData: new FormData(),
    });
    assertEquals(router.state.actionData, { "/": { saved: true } });
    const action = loads();
    await router.revalidate();
    return { search, action, revalidate: loads() };
  } finally {
    router.dispose();
  }
}

describe("shouldRevalidate route export", () => {
  it("createRoute passes the export through unchanged", () => {
    const route = createRoute({
      default: () => <div />,
      shouldRevalidate: keepLoaderData,
    });
    assert(route.shouldRevalidate === keepLoaderData);
  });

  it("createRoute leaves shouldRevalidate unset when the module has none", () => {
    const route = createRoute({ default: () => <div /> });
    assertEquals(route.shouldRevalidate, undefined);
  });

  it("createLazyRoute resolves with the module's export", async () => {
    const lazy = createLazyRoute(() =>
      Promise.resolve({
        default: () => <div />,
        shouldRevalidate: keepLoaderData,
      })
    );
    const route = await lazy();
    assert(route.shouldRevalidate === keepLoaderData);
  });

  it("an eager route object carries the export", () => {
    const client = new Client({
      path: "/",
      main: { default: () => <Outlet />, shouldRevalidate: keepLoaderData },
    });
    assert(client.routeObjectMap.get("/")?.shouldRevalidate === keepLoaderData);
  });

  it("loadLazyMatches copies the export onto the hydrating route", async () => {
    const client = new Client(
      {
        path: "/",
        main: { default: () => <Outlet /> },
        children: [{
          path: "about",
          main: () =>
            Promise.resolve({
              default: () => <div />,
              shouldRevalidate: keepLoaderData,
            }),
        }],
      } satisfies RootClientRoute,
    );
    const route = client.routeObjectMap.get("/about");
    assert(route?.lazy);
    assertEquals(route.shouldRevalidate, undefined);
    await client.loadLazyMatches([{ id: "/about" }]);
    assertEquals(route.lazy, undefined);
    assert(route.shouldRevalidate === keepLoaderData);
  });

  it("the router revalidates a route's loader on a search change by default", async () => {
    const { module, loads } = countingRoute();
    const client = new Client({ path: "/", main: module });
    assertEquals(await loadsAfterSearchChange(client, "/", loads), 2);
  });

  it("an eager route's export stops the router from revalidating its loader", async () => {
    const { module, loads } = countingRoute(keepLoaderData);
    const client = new Client({ path: "/", main: module });
    assertEquals(await loadsAfterSearchChange(client, "/", loads), 1);
  });

  it("a lazy route's export stops the router from revalidating its loader", async () => {
    const { module, loads } = countingRoute(keepLoaderData);
    const client = new Client({
      path: "/",
      main: { default: () => <Outlet /> },
      children: [{ path: "about", main: () => Promise.resolve(module) }],
    });
    assertEquals(await loadsAfterSearchChange(client, "/about", loads), 1);
  });

  it("the documented search-only skip still reloads after an action and revalidate()", async () => {
    assertEquals(await loadsAcrossChanges(skipSearchOnlyChanges), {
      search: 1,
      action: 2,
      revalidate: 3,
    });
  });

  it("a pathname-only skip also drops the reloads after an action and revalidate()", async () => {
    assertEquals(await loadsAcrossChanges(skipSamePathname), {
      search: 1,
      action: 1,
      revalidate: 1,
    });
  });

  it("a lazy root's export stops the router from revalidating its loader", async () => {
    const { module, loads } = countingRoute(keepLoaderData);
    const client = new Client({
      path: "/",
      main: () => Promise.resolve(module),
    });
    assert(client.routeObjectMap.get("/")?.lazy);
    assertEquals(await loadsAfterSearchChange(client, "/", loads), 1);
  });
});
