---
title: Juniper Guides
last_verified: 2026-09-09
---

# Juniper Guides

Juniper renders React routes on Deno, uses Hono for HTTP requests, and uses
React Router for navigation after hydration. Start with a template, then add
loaders, actions, and middleware to matching route files.

## Learn the framework

1. [Introduction](introduction.md): architecture and where code runs.
2. [Getting started](getting-started.md): run a template or create a project.
3. [Routing](routing.md): file conventions, loaders, and pending navigation.
4. [Forms](forms.md): actions, validation, fetchers, and file uploads.
5. [Testing](testing.md): exercise routes and their HTTP boundary.

For a complete application, follow the [blog tutorial](tutorials/blog.md). Its
[tutorial index](tutorials/README.md) explains the example's scope.

## Find a guide

| Task                                                 | Guide                                     |
| ---------------------------------------------------- | ----------------------------------------- |
| Configure imports, builds, and environment variables | [Configuration](configuration.md)         |
| Run the dev server, debug, or adjust file watching   | [Development tools](development-tools.md) |
| Authenticate requests and initialize context         | [Middleware](middleware.md)               |
| Share state and cache loader results                 | [State management](state-management.md)   |
| Render errors and register custom serializers        | [Error handling](error-handling.md)       |
| Add CSS, Tailwind, or preprocessors                  | [Styling](styling.md)                     |
| Serve assets and set cache headers                   | [Static files](static-files.md)           |
| Set titles, metadata, and structured data            | [Metadata](metadata.md)                   |
| Use Deno KV or PostgreSQL                            | [Database](database.md)                   |
| Add logs, traces, and metrics                        | [Logging](logging.md)                     |
| Validate and publish in CI                           | [CI/CD](ci-cd.md)                         |
| Run a production build                               | [Deployment](deployment.md)               |

## Boundaries to keep in mind

- A `.ts` route contains server-only Hono handlers, loaders, or actions. Match
  its filename with a `.tsx` route when it supplies that page's data.
- A `.tsx` route is rendered on the server too. Its loader or action also runs
  there when no matching server handler replaces it. Guard browser-only APIs.
- Route data arrives through props. `HydrateFallback` handles a loaded route's
  pending data; an already loaded layout uses `useNavigation` while another
  route's module or blocking loader is pending.
- Enforce access control on the server. Client middleware provides navigation
  behavior; registered context and public environment variables reach the
  browser.
- Use `deno task test` so tests receive the project's permissions and
  environment. `createRoutesStub` tests the client route adapter; HTTP tests
  verify Hono middleware and server handlers.

The [JSR API reference](https://jsr.io/@udibo/juniper/doc) documents exported
types and methods. Guides explain how those APIs fit together. Examples that
refer to application services assume those services exist; complete test
examples include their fixtures.

## Changelog

- **2026-09-09** — Added a learning path, full guide index, and execution and
  trust boundaries to make the documentation easier to navigate.
