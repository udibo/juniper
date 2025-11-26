# AGENTS.md

## Testing

- Use `deno task test` to run all tests across the workspace.
  - It runs `deno test` with the correct permissions and environment variables.
  - Never call `deno test` directly.
  - The test task can take all the same arguments as `deno test`.
  - To run tests for a specific file, use `deno task test ./src/server.test.tsx`
  - Prefer running tests more narrowly to reduce token usage. Output is large
    when running all tests.
  - Temporarily change `describe` or `it` to `describe.only` or `it.only` to
    focus specific test groups or cases.
- Workspace-specific test tasks are available:
  - `deno task test:juniper` runs tests for the src (Juniper library) workspace.
  - `deno task test:example` runs tests for the example workspace.
  - `deno task test:minimal` runs tests for the minimal template workspace.
- To get updated test coverage statistics for the Juniper library, run
  `deno task test:juniper --coverage`. Then run `deno coverage --detailed` from
  the src directory to see lines that are missing coverage.
- For live reload of changes in the browser
  - start the dev server with `deno task dev`.
  - This runs the example project's development server.
  - After any edits are made to the example, it will rebuild the application and
    refresh the page.
- CI will reject a commit if it doesn't pass `deno task check`.
- Formatting issues can be automatically fixed with `deno fmt`.
- For stubs and spys, prefer using explicit resource management over manually
  adding try/finally with restore call.

## Style

### Types

Try to avoid ever using the `any` type.

### Imports

Imports should be split up into 4 groups as shown in the example below. The
comments are there to explain the code style.

```ts
// Third party module imports
import { assertEquals, assertStringIncludes } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Hono } from "hono";
import type { Env, Schema } from "hono"; // Types imported separately immediately after regular imports
import SuperJSON from "superjson";

// First party module imports
import { isDevelopment } from "@udibo/juniper/utils/env";

// Imports using absolute paths in the example directory
import { server } from "/main.ts";
import { postService } from "/services/post.ts";
import type { NewPost } from "/services/post.ts";

// Relative path imports
import { Button } from "./button.tsx";
```

Here is a copy of all first party modules from the src/deno.json configuration
file. Never import them by their relative path. For example, import the server
module using "@udibo/juniper/server" instead of "./server.tsx".

```json
"exports": {
  ".": "./mod.ts",
  "./build": "./build.ts",
  "./dev": "./dev.ts",
  "./server": "./server.tsx",
  "./client": "./client.tsx",
  "./utils/env": "./utils/env.ts",
  "./utils/otel": "./utils/otel.ts",
  "./utils/testing": "./utils/testing.ts"
},
```
