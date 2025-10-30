# AGENTS.md

## Testing

- Use `deno task test` to run tests.
  - It runs `deno test` with the correct permissions and environment variables.
  - Never call `deno test` directly.
  - The test task can take all the same arguments as `deno test`.
  - To run tests for a specific file, use `deno task test ./server.test.tsx`
- For live reload of changes in the browser
  - start the dev server with `deno task dev`.
  - After any edits are made to the example, it will rebuild the application and
    refresh the page.
- CI will reject a commit if it doesn't pass `deno task check`.
- Formatting issues can be automatically fixed with `deno fmt`.

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

Here is a copy of all first party modules from the deno.json configuration file.
Never import them by their relative path. For example, import the server module
using "@udibo/juniper/server" instead of "./server.tsx".

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
