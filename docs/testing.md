---
title: Testing
last_verified: 2026-09-09
---

# Testing

Use component tests for UI behavior, `createRoutesStub` for Juniper's client
route adapter, and HTTP tests for server middleware and handlers. A mocked
loader does not verify authentication, serialization, or database access.

## Test Setup

### Running Tests

Run the task defined by your application so every run receives its permissions
and environment files:

```bash
deno task test --parallel --reporter=dot
deno task test routes/blog/index.test.tsx
deno task test --filter "BlogIndex"
deno task test --watch
```

The templates already define this task. A minimal configuration is:

```json
{
  "tasks": {
    "test": "deno test -P=test --env-file --env-file=.env.test"
  },
  "permissions": {
    "test": {
      "env": true,
      "read": true,
      "net": true,
      "run": true
    }
  }
}
```

Add permissions required by your application's own fixtures, such as writing
snapshots. Import `@udibo/juniper/utils/global-jsdom` before Testing Library in
a DOM test. Its browser globals include form submission support; this is still
JSDOM, so validate layout and browser-specific behavior in a browser as well.
Always unmount rendered components with `cleanup`.

The action example also uses `@testing-library/user-event`. Add
`"@testing-library/user-event": "npm:@testing-library/user-event@^14.6.1"` to
your test project's import map if it is not already present.

## Testing Utilities

### createRoutesStub

`createRoutesStub` accepts a flat list of Juniper route modules and returns a
component backed by a memory router. Spread the real module and replace only the
loader or action whose dependency you want to control:

```tsx
const Stub = createRoutesStub([{
  ...profileRoute,
  path: "/profile",
  loader: () => ({ name: "Ada" }),
}]);
render(<Stub initialEntries={["/profile"]} />);
```

The default initial entry is the first route's `path`, or `/`. Pass
`hydrationData` for data already available before the initial render. React
Router assigns the memory-router IDs; a single unnamed route uses `"0"`.

The adapter exercises route props, loaders, actions, `HydrateFallback`, and
error boundaries. It does **not** run the route's `middleware`, discover a
matching `.ts` module, or model nested layout routes. Seed middleware-provided
context explicitly:

```tsx
const Stub = createRoutesStub([profileRoute], {
  getContext(context) {
    context.set(userContext, { id: "test-user", name: "Ada" });
  },
});
```

Use `serverFlags: { loader: true }` or `{ action: true }` with `routeId` when
testing the adapter's HTTP call to a server handler. Here `routeId` selects the
`X-Juniper-Route-Id` request header. Stub that request or direct it to a test
server. It does not give the memory route a custom ID.

### simulateEnvironment

`simulateEnvironment` returns a callback; pass it to `it`, or invoke it
explicitly. Overrides are scoped to the callback's async work and nest without
modifying `Deno.env`. Code under test must read through Juniper's `getEnv`;
direct `Deno.env.get` calls do not see the overrides. A `null` override makes
`getEnv` return `undefined` for that key.

```ts
import { assertEquals } from "@std/assert";
import { it } from "@std/testing/bdd";
import { getEnv } from "@udibo/juniper/utils/env";
import { simulateEnvironment } from "@udibo/juniper/utils/testing";

it(
  "uses a scoped environment",
  simulateEnvironment({
    APP_ENV: "test",
    DEBUG: null,
  }, async () => {
    await Promise.resolve();
    assertEquals(getEnv("APP_ENV"), "test");
    assertEquals(getEnv("DEBUG"), undefined);
  }),
);
```

### stubFetch

`stubFetch` replaces global `fetch` and restores it when a `using` declaration
leaves scope. A supplied `Response` is cloned for each call. A function can
inspect the request and create a different response:

```ts
import { assertEquals } from "@std/assert";
import { it } from "@std/testing/bdd";
import { stubFetch } from "@udibo/juniper/utils/testing";

it("handles an API response", async () => {
  using fetchStub = stubFetch((input) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.endsWith("/users/123")
      ? Response.json({ name: "Ada" })
      : new Response("Not found", { status: 404 });
  });
  const response = await fetch("https://example.test/users/123");
  assertEquals(await response.json(), { name: "Ada" });
  assertEquals(fetchStub.calls.length, 1);
});
```

### fetchResolver

`fetchResolver()` returns `[resolveFetch, fakeFetch]`. Pass `fakeFetch` to
`stubFetch`, start the request, assert the pending UI, then call
`resolveFetch(response)`. It controls one outstanding request: resolving before
a request starts does nothing, and a second concurrent request replaces the
stored resolver. Use separate controlled promises for concurrent requests or
cancellation. Resolve pending work in `finally` so a failed assertion can clean
up too.

## Component Testing

Assert behavior visible to a user: labels, text, enabled controls, and the
result of interaction. Use accessible queries rather than component internals.
For absence use `assertFalse(screen.queryByRole(...))`; for node identity use
`assert(before === after)`. Passing a DOM node to deep-equality assertions can
produce enormous failure diffs.

## Route Testing

### Testing Loaders

This complete test holds a loader pending, verifies the fallback, and then
resolves the data. It needs no arbitrary timer delay:

```tsx
import "@udibo/juniper/utils/global-jsdom";

import { assertFalse } from "@std/assert";
import { afterEach, it } from "@std/testing/bdd";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { AnyParams, RouteProps } from "@udibo/juniper";
import { createRoutesStub } from "@udibo/juniper/utils/testing";

interface LoaderData {
  message: string;
}

afterEach(cleanup);

it("replaces the loading fallback with loader data", async () => {
  const data = Promise.withResolvers<LoaderData>();
  const Stub = createRoutesStub([{
    loader: () => data.promise,
    HydrateFallback: () => <p role="status">Loading message…</p>,
    default: ({ loaderData }: RouteProps<AnyParams, LoaderData>) => (
      <h1>{loaderData.message}</h1>
    ),
  }]);
  render(<Stub />);
  try {
    await screen.findByText("Loading message…");
    assertFalse(screen.queryByRole("heading"));
    await act(() => data.resolve({ message: "Loaded" }));
    await screen.findByRole("heading", { name: "Loaded" });
    assertFalse(screen.queryByText("Loading message…"));
  } finally {
    await act(() => data.resolve({ message: "Loaded" }));
  }
});
```

For navigation feedback, hold the destination's loader or lazy module pending.
Assert that the current content remains visible, the status appears, and it
clears on success, cancellation, or error. A route's own `HydrateFallback`
cannot render before its module loads. See
[pending navigation](routing.md#pending-navigation).

### Testing Actions

Render a form, submit it, and assert the result. Defining a stubbed action does
not execute it. This complete example verifies the submitted value and pending
state too:

```tsx
import "@udibo/juniper/utils/global-jsdom";

import { assertEquals, assertFalse } from "@std/assert";
import { afterEach, it } from "@std/testing/bdd";
import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Form, useNavigation } from "react-router";
import type { AnyParams, RouteProps } from "@udibo/juniper";
import { createRoutesStub } from "@udibo/juniper/utils/testing";

interface ActionData {
  message: string;
}

function NameForm(
  { actionData }: RouteProps<AnyParams, unknown, ActionData>,
): React.JSX.Element {
  const navigation = useNavigation();
  return (
    <Form method="post">
      <label>
        Name<input name="name" />
      </label>
      <button type="submit" disabled={navigation.state === "submitting"}>
        Save
      </button>
      <p role="status">{actionData?.message}</p>
    </Form>
  );
}

afterEach(cleanup);

it("submits the name and displays the action result", async () => {
  const result = Promise.withResolvers<ActionData>();
  let submitted: FormDataEntryValue | null = null;
  const Stub = createRoutesStub([{
    default: NameForm,
    action: async ({ request }) => {
      submitted = (await request.formData()).get("name");
      return await result.promise;
    },
  }]);
  render(<Stub />);
  const user = userEvent.setup();
  try {
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Ada");
    await user.click(screen.getByRole("button", { name: "Save" }));
    assertEquals(submitted, "Ada");
    assertEquals(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
      true,
    );
    assertFalse(screen.queryByText("Saved Ada"));
    await act(() => result.resolve({ message: "Saved Ada" }));
    await screen.findByText("Saved Ada");
  } finally {
    await act(() => result.resolve({ message: "Saved Ada" }));
  }
});
```

Use `fetcher.data` for a `fetcher.Form` result; the route's `actionData` prop is
for navigational submissions. Add a rejection case to verify the error boundary,
and test the real server action separately.

## Integration Testing

Import the generated `server` from `main.ts` and call `server.request()` to
exercise Hono middleware, server loaders/actions, status codes, and SSR without
binding a port. This example checks a page in the blog tutorial:

```ts
import { assertEquals, assertStringIncludes } from "@std/assert";
import { it } from "@std/testing/bdd";
import { server } from "./main.ts";

it("serves the blog home page", async () => {
  const response = await server.request("http://localhost/");
  assertEquals(response.status, 200);
  assertStringIncludes(await response.text(), "My Blog");
});
```

Create fixtures in an isolated test database, delete only rows the test owns,
and close database connections after the suite. For protected routes, verify
unauthorized requests do not invoke protected services or expose their data in
HTML or data responses. A client-side guard test cannot prove this.

For a process-level test, bind `DENO_SERVE_ADDRESS=tcp:127.0.0.1:0`, discover
the selected port from the child process, and dispose the process. See the
[blog server test](tutorials/blog.md#testing-the-server).

## Mocking

### Spies and Stubs

Use `spy` and `stub` from `@std/testing/mock`, with `using` for cleanup even
when an assertion fails. Global stubs affect all code in that isolate; do not
overlap tests that replace the same global.

### Fakes

Use `FakeTime` from `@std/testing/time` for clock-dependent behavior. Prefer
controlled promises when the only requirement is keeping a request pending.

### waitForFakeTime

With `FakeTime` active, Testing Library's `waitFor` can hang on its internal
timer used to drain pending work. Use Juniper's
`waitForFakeTime(time, callback)` instead. It temporarily uses real timers to
drain work due at the current fake time and wait for assertions. Advance elapsed
fake time explicitly with `time.tick()` or `time.tickAsync()` when testing a
timeout. Without fake time, use Testing Library's normal `waitFor`.

### Testing with Deno KV

Use `Deno.openKv(":memory:")` for an isolated database, enable the `kv` unstable
feature in the test project, and close the handle at the end of the test:

```ts
import { assertEquals } from "@std/assert";
import { it } from "@std/testing/bdd";

it("stores a value", async () => {
  using kv = await Deno.openKv(":memory:");
  await kv.set(["example"], { value: 42 });
  assertEquals((await kv.get(["example"])).value, { value: 42 });
});
```

### Snapshot Testing

`isSnapshotMode()` checks script arguments for `--update` or `-u`. Pass them
after the test runner's `--` separator, for example
`deno task test routes/example.test.ts -- --update`. Normal runs compare the
result with a committed snapshot; update runs write the result. Review the
snapshot diff and keep behavioral assertions for important state changes.

## Next Steps

- [Guide index](README.md)
- [Forms](forms.md): route actions and fetchers.
- [Error handling](error-handling.md): failure paths and serialization.
- [CI/CD](ci-cd.md): run the same validation in automation.

## Changelog

- **2026-09-09** — Clarified that waitForFakeTime drains due work without
  advancing elapsed fake time.

- **2026-09-09** — Replaced action tests that never submitted with complete
  interaction tests, documented adapter boundaries and environment isolation,
  and corrected task invocation, fixture cleanup, and snapshot arguments.
