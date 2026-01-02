# Testing

## Overview

Juniper provides testing utilities built on Deno's standard testing library and Testing Library for React. Tests run with `deno test` and support component testing, route testing, and integration testing.

## Test Setup

### Running Tests

Run tests using the Deno task defined in your `deno.json`:

```bash
# Run all tests
deno task test

# Run tests in watch mode
deno task test --watch

# Run a specific test file
deno test routes/blog/index.test.tsx

# Run tests matching a filter
deno test --filter "BlogIndex"
```

### Test Configuration

Configure test permissions and settings in your `deno.json`:

```json
{
  "tasks": {
    "test": {
      "description": "Runs the tests.",
      "command": "deno test -P=test --env-file --env-file=.env.test"
    }
  },
  "permissions": {
    "test": {
      "env": true,
      "read": ["./public", "./node_modules"],
      "net": true,
      "run": true
    }
  }
}
```

For testing React components, import the global JSDOM setup at the top of your test files:

```typescript
import "@udibo/juniper/utils/global-jsdom";
```

## Testing Utilities

Juniper provides several utilities in `@udibo/juniper/utils/testing` to simplify testing.

### createRoutesStub

Creates a stub component for testing Juniper route modules:

```tsx
import "@udibo/juniper/utils/global-jsdom";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as loaderRoute from "./loader.tsx";

describe("LoaderDemo route", () => {
  afterEach(cleanup);

  it("should render loaded data", async () => {
    const Stub = createRoutesStub([loaderRoute]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("Data loaded successfully!");
    });
  });
});
```

Override loaders or actions by spreading the route module:

```tsx
it("should render with stubbed loader data", async () => {
  const Stub = createRoutesStub([{
    ...loaderRoute,
    loader() {
      return {
        timestamp: "2025-01-01T00:00:00.000Z",
        randomNumber: 42,
        message: "Stubbed data!",
      };
    },
  }]);
  render(<Stub />);

  await waitFor(() => {
    screen.getByText("Stubbed data!");
  });
});
```

Configure initial context for dependencies like QueryClient:

```tsx
import { QueryClient } from "@tanstack/react-query";
import { queryClientContext } from "@/context/query.ts";

const Stub = createRoutesStub([contactsRoute], {
  getContext(context) {
    context.set(queryClientContext, new QueryClient());
  },
});
```

### simulateEnvironment

Simulates environment variables for the duration of a test:

```typescript
import { simulateEnvironment } from "@udibo/juniper/utils/testing";
import { getEnv } from "@udibo/juniper/utils/env";
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

describe("Environment tests", () => {
  it("should use simulated environment", simulateEnvironment({
    "APP_ENV": "production",
    "DEBUG": null, // Delete this variable
  }, () => {
    assertEquals(getEnv("APP_ENV"), "production");
    assertEquals(getEnv("DEBUG"), undefined);
  }));

  it("should support async callbacks", simulateEnvironment({
    "APP_ENV": "test",
  }, async () => {
    assertEquals(getEnv("APP_ENV"), "test");
    await Promise.resolve();
  }));
});
```

### stubFetch

Stubs the global `fetch` function for controlled responses:

```typescript
import { stubFetch } from "@udibo/juniper/utils/testing";
import { assertEquals } from "@std/assert";

describe("API tests", () => {
  it("should handle successful response", async () => {
    using fetchStub = stubFetch(Response.json({ id: "123", name: "John" }));

    const response = await fetch("/api/users/123");
    const data = await response.json();

    assertEquals(data.name, "John");
    assertEquals(fetchStub.calls.length, 1);
  });

  it("should handle dynamic responses", async () => {
    using _fetchStub = stubFetch((input) => {
      if (input.toString().includes("/users")) {
        return Response.json([{ id: "1", name: "Alice" }]);
      }
      return new Response("Not Found", { status: 404 });
    });

    const response = await fetch("/api/users");
    const data = await response.json();
    assertEquals(data[0].name, "Alice");
  });
});
```

### fetchResolver

Creates a deferred fetch for testing loading states:

```typescript
import { fetchResolver, stubFetch } from "@udibo/juniper/utils/testing";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

it("should show loading state while submitting", async () => {
  const [resolveFetch, fakeFetch] = fetchResolver();
  using _fetchStub = stubFetch(fakeFetch);
  const user = userEvent.setup();

  render(<MyForm />);
  await user.click(screen.getByRole("button", { name: "Submit" }));

  // Verify loading state
  await waitFor(() => {
    screen.getByText("Loading...");
  });

  // Resolve the pending request
  resolveFetch(Response.json({ success: true }));

  // Verify success state
  await waitFor(() => {
    screen.getByText("Success!");
  });
});
```

## Component Testing

Test React components using Testing Library:

```tsx
import "@udibo/juniper/utils/global-jsdom";
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen } from "@testing-library/react";

import { InfoBox } from "@/components/InfoBox.tsx";

describe("InfoBox", () => {
  afterEach(() => cleanup());

  it("should render children and an optional title", () => {
    render(
      <InfoBox title="Details">
        <p>Content</p>
      </InfoBox>
    );

    const heading = screen.getByRole("heading", { name: "Details" });
    assertEquals(heading.tagName, "H3");
    screen.getByText("Content");
  });

  it("should omit the title heading when not provided", () => {
    render(
      <InfoBox>
        <p>Body</p>
      </InfoBox>
    );

    assertEquals(screen.queryByRole("heading"), null);
    screen.getByText("Body");
  });

  it("should apply color and className", () => {
    const { container } = render(
      <InfoBox color="slate" className="extra-box">
        <p>Body</p>
      </InfoBox>
    );

    const el = container.firstElementChild;
    assert(el);
    assertStringIncludes(el.className, "bg-slate-800/50");
    assertStringIncludes(el.className, "extra-box");
  });
});
```

## Route Testing

### Testing Loaders

Test loaders with `createRoutesStub`:

```tsx
import "@udibo/juniper/utils/global-jsdom";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { stub } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as loaderRoute from "./loader.tsx";

describe("LoaderDemo route", () => {
  let time: FakeTime;
  let randomStub: { restore: () => void };

  beforeEach(() => {
    time = new FakeTime(new Date("2025-01-15T12:00:00.000Z"));
    randomStub = stub(Math, "random", () => 0.42);
  });

  afterEach(() => {
    randomStub.restore();
    time.restore();
    cleanup();
  });

  it("should show HydrateFallback while loading", async () => {
    const Stub = createRoutesStub([loaderRoute]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("Loading data...");
    });
  });

  it("should render loaded data after loader completes", async () => {
    const Stub = createRoutesStub([loaderRoute]);
    render(<Stub />);

    await time.tickAsync(600);

    await waitFor(() => {
      screen.getByText("Data loaded successfully!");
    });
  });
});
```

### Testing Actions

Test form actions with stubbed action functions:

```tsx
import "@udibo/juniper/utils/global-jsdom";
import { afterEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as actionRoute from "./action.tsx";

describe("FormAction route", () => {
  afterEach(cleanup);

  it("should display the form", () => {
    const Stub = createRoutesStub([actionRoute]);
    render(<Stub />);

    screen.getByLabelText("Name");
    screen.getByLabelText("Email");
    screen.getByRole("button", { name: "Submit" });
  });

  it("should render with stubbed action data", () => {
    const Stub = createRoutesStub([{
      ...actionRoute,
      action() {
        return {
          success: true,
          message: "Form submitted successfully!",
          submittedAt: "2025-01-15T12:00:00.000Z",
          formData: { name: "Test User", email: "test@example.com" },
        };
      },
    }]);
    render(<Stub />);

    // Verify form is rendered
    screen.getByLabelText("Name");
  });
});
```

## Integration Testing

Test complete routes with real loaders and services:

```tsx
import "@udibo/juniper/utils/global-jsdom";
import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRoutesStub } from "@udibo/juniper/utils/testing";

import * as blogIndexRoute from "./index.tsx";
import { postService } from "@/services/post.ts";

describe("Blog Index Integration", () => {
  beforeEach(async () => {
    // Set up test data
    await postService.create({
      title: "Test Post",
      content: "Test content",
      authorId: "test-author",
    });
  });

  afterEach(async () => {
    // Clean up test data
    const { entries } = await postService.list();
    for (const post of entries) {
      await postService.delete(post.id);
    }
    cleanup();
  });

  it("should display posts from the database", async () => {
    const Stub = createRoutesStub([blogIndexRoute]);
    render(<Stub />);

    await waitFor(() => {
      screen.getByText("Test Post");
    });
  });
});
```

## Mocking

### Spies and Stubs

Use Deno's standard testing library for spies and stubs:

```typescript
import { stub, spy, assertSpyCalls } from "@std/testing/mock";
import { describe, it, afterEach } from "@std/testing/bdd";

describe("Service tests", () => {
  it("should spy on function calls", () => {
    const consoleSpy = spy(console, "log");

    myFunction();

    assertSpyCalls(consoleSpy, 1);
    consoleSpy.restore();
  });

  it("should stub function return values", async () => {
    const fetchStub = stub(
      globalThis,
      "fetch",
      () => Promise.resolve(Response.json({ data: "mocked" }))
    );

    const result = await fetchData();
    assertEquals(result.data, "mocked");

    fetchStub.restore();
  });
});
```

Use the `using` keyword for automatic cleanup:

```typescript
it("should auto-cleanup with using", () => {
  using randomStub = stub(Math, "random", () => 0.5);

  assertEquals(Math.random(), 0.5);
  // Stub automatically restored when scope exits
});
```

### Fakes

Use `FakeTime` for time-dependent tests:

```typescript
import { FakeTime } from "@std/testing/time";

describe("Time-dependent tests", () => {
  it("should control time", async () => {
    using time = new FakeTime(new Date("2025-01-15T12:00:00.000Z"));

    // Current time is mocked
    assertEquals(new Date().toISOString(), "2025-01-15T12:00:00.000Z");

    // Advance time
    await time.tickAsync(1000);
    assertEquals(new Date().toISOString(), "2025-01-15T12:00:01.000Z");
  });
});
```

### Testing with Deno KV

Use in-memory KV for isolated tests:

```typescript
import { isTest } from "@udibo/juniper/utils/env";

async function getKv(): Promise<Deno.Kv> {
  if (!kv) {
    // Use in-memory database for tests
    kv = await (isTest() ? Deno.openKv(":memory:") : Deno.openKv());
  }
  return kv;
}
```

Or create isolated KV instances per test:

```typescript
describe("Service tests", () => {
  let kv: Deno.Kv;

  beforeEach(async () => {
    kv = await Deno.openKv(":memory:");
  });

  afterEach(() => {
    kv.close();
  });

  it("should store and retrieve data", async () => {
    await kv.set(["test"], { value: 42 });
    const entry = await kv.get(["test"]);
    assertEquals(entry.value, { value: 42 });
  });
});
```

### Snapshot Testing

Use `isSnapshotMode` for manual snapshot management:

```typescript
import { isSnapshotMode } from "@udibo/juniper/utils/testing";
import { assertEquals } from "@std/assert";
import { resolve } from "@std/path";

it("should match API response snapshot", async () => {
  const response = await fetch("http://localhost:8000/api/hello");
  const body = await response.text();

  const snapshotPath = resolve(import.meta.dirname!, "./hello.json");

  if (isSnapshotMode()) {
    // Update snapshot with: deno test --update
    await Deno.writeTextFile(snapshotPath, body);
  } else {
    const snapshot = await Deno.readTextFile(snapshotPath);
    assertEquals(body, snapshot);
  }
});
```

## Next Steps

**Next:** [Logging](logging.md) - Logging and OpenTelemetry

**Related topics:**

- [CI/CD](ci-cd.md) - GitHub Actions workflows
- [Configuration](configuration.md) - Project and build configuration
- [Database](database.md) - Deno KV and other databases
