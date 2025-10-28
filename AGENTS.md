# AGENTS.md

## Testing

- Use `deno task test` to run tests.
  - It runs `deno test` with the correct permissions and environment variables.
  - Never call `deno test` directly.
  - The test task can take all the same arguments as `deno test`.
- For live reload of changes in the browser
  - start the dev server with `deno task dev`.
  - After any edits are made to the example, it will rebuild the application and
    refresh the page.

## Style

### Imports

- For exported modules, prefer importing from `@udibo/juniper` instead of
  relative paths.
  - For example, use `@udibo/juniper/server` instead of `./server.tsx`.
  - Exported modules are configured in `deno.json`
- For internal modules, use relative paths.
- Files in the example directory should not import any internal Juniper modules.
  - It can import `@udibo/juniper/server`.
  - It should never import `../_server.tsx`.
- Example imports should use absolute paths if outside curent directory.
  - The root directory is the example directory.
  - Absolute paths like `/main.tsx` will import `./example/main.tsx`.
  - For example, use `/components/button.tsx` instead of
    `../../components/button.tsx`.
  - It is still fine to use relative paths instead of absolute if files are in
    the same directory.
    - For example, `./button.tsx` is fine but `../components/button.tsx` is not.
- Imports should be in 3 groups separated by a new line
  - Thirt party modules from import map
  - `@udibo/juniper` modules
  - Absolute or relative paths
- Separate regular imports and type only imports.
  - Prefer `import type { Example } from "@udibo/juniper";` over
    `import { type Example } from "@udibo/juniper";`.
