# Testing

Reliable tests keep generated entrypoints and complicated routing logic safe.
This guide covers the provided `deno task` commands, Juniper’s testing
utilities, and recommendations for coverage.

## Tasks and permissions

- `deno task test` runs `deno test -P=test --env-file --env-file=.env.test`. The
  `test` permission profile grants `net`, `env`, `read`, `write`, and `run` so
  tests can exercise Deno KV and spawn subprocesses.
- `deno task test-update` forwards `--update` to refresh snapshots.

When running tests manually, match the task’s flags so the same env files are
loaded.

## Utilities

`@udibo/juniper/utils/testing` exposes helpers that simplify environment
control:

- `isSnapshotMode()` – returns `true` when `--update` or `-u` was passed. Use it
  to write custom snapshot files.
- `simulateEnvironment()` – temporarily overrides `Deno.env` values. Great for
  tests that change `APP_ENV` or secrets.
- `simulateBrowser()` – serializes hydration data and injects it into
  `globalThis`, allowing you to run client-side hooks in a simulated browser
  context (without JSDOM).

Example:

```ts
import { simulateEnvironment } from "@udibo/juniper/utils/testing";

describe("feature flags", () => {
  it("enables preview in test env", () => {
    using _env = simulateEnvironment({ APP_ENV: "test" });
    assertTrue(isTest());
  });
});
```

## Server route tests

Tests colocated with route files (such as `routes/api/users.test.ts`) can import
the route module, instantiate Hono, and assert responses:

```ts
import app from "./users.ts";

describe("GET /api/users", () => {
  it("lists users", async () => {
    const response = await app.request("http://localhost/");
    assertEquals(response.status, 200);
  });
});
```

Because each route exports a Hono instance, you do not need to spin up the
entire server to test JSON endpoints.

## Client route tests

- Use React Testing Library with `render(<RouteComponent loaderData={...} />)`
  to verify markup.
- For more realistic tests, combine `simulateBrowser()` with
  `client.routeObjects` to hydrate the router in-memory.
- Snapshot streaming output when necessary, but prefer testing UI behavior
  (text, aria attributes) to avoid brittle snapshots.

## Snapshot workflow

`isSnapshotMode()` lets you manage plain-text snapshots anywhere in the repo:

```ts
if (isSnapshotMode()) {
  await Deno.writeTextFile(snapshotPath, body);
} else {
  const snapshot = await Deno.readTextFile(snapshotPath);
  assertEquals(body, snapshot);
}
```

This pattern keeps snapshots close to the routes they verify and avoids hidden
magic.

## Coverage

To generate coverage:

```bash
deno task test -- --coverage=./cov
deno coverage ./cov --detailed
```

Juniper’s CI workflow uploads coverage to Codecov. Locally, the detailed report
highlights uncovered lines so you can target missing branches.

## Next steps

- Read [Logging](logging.md) to capture helpful diagnostics when tests fail.
- Consult [CI/CD](ci-cd.md) for integrating tests into GitHub Actions or your
  preferred pipeline.
