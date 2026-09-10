# Introduction

## What is Juniper?

Juniper is a web framework for building React applications with Deno. It
combines the power of [Hono](https://hono.dev/) for server-side routing with
[React Router](https://reactrouter.com/) for client-side navigation, providing a
seamless full-stack development experience.

The framework uses file-based routing, making it easy to understand your
application's structure at a glance. Routes are organized as a tree of files and
directories, with each file representing a route in your application.

Juniper uses Deno's TypeScript support, permission model, and tooling. It
renders HTML on the server, then hydrates that HTML with React in the browser.
Request latency still depends on your loaders, services, and deployment; the
application supplies loading feedback for slow work.

## Key Features

- **File-Based Routing**: Create routes by adding files to your `routes`
  directory. The file structure directly maps to your URL structure.

- **Server-Side Rendering**: React components render on the server for fast
  initial page loads and SEO benefits.

- **Data Loading and Actions**: Fetch data with loaders and handle form
  submissions with actions, on either server or client.

- **Hot Reload**: See changes instantly during development.

- **TypeScript First**: Full TypeScript support with type-safe route parameters,
  loader data, and action data.

- **React 19 Support**: Built for React 19, including native document metadata
  support with `<title>` and `<meta>` tags in components.

- **Hono Middleware**: Use Hono's extensive middleware ecosystem for
  authentication, logging, CORS, and more.

- **Context Sharing**: Share data between middleware, loaders, actions, and
  components with React Router's context system.

- **Error Boundaries**: Graceful error handling with route-level and root error
  boundaries.

- **Code Splitting**: Automatic code splitting for routes, loading only the code
  needed for each page.

## Architecture Overview

Juniper follows a layered architecture with clear separation between server and
client concerns:

```
┌─────────────────────────────────────────────────────────┐
│                      Client (Browser)                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │              React Router + Components           │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            │
                     HTTP Requests
                            │
┌─────────────────────────────────────────────────────────┐
│                      Server (Deno)                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │                   Hono Server                    │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐   │    │
│  │  │ Middleware│→ │  Loaders  │→ │   SSR     │   │    │
│  │  └───────────┘  └───────────┘  └───────────┘   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Server Layer (Hono)**

- Handles incoming HTTP requests
- Executes middleware for authentication, logging, etc.
- Runs server loaders to fetch data
- Runs server actions to handle form submissions
- Renders React components to HTML for SSR

**Client Layer (React Router)**

- Hydrates server-rendered HTML
- Handles client-side navigation
- Manages route transitions and loading states
- Runs client loaders and actions when defined

**Route Modules** A React route module (`.tsx`) can export:

- `default` - The React component to render
- `loader` - A function to fetch data before rendering
- `action` - A function to handle form submissions
- `middleware` - Functions that run before loaders and actions
- `ErrorBoundary` - A component to display when errors occur
- `HydrateFallback` - A fallback for unresolved route data, including streamed
  server rendering and client loading

The matching `.ts` module contains server loaders, actions, and an optional
default Hono application. Pair filenames exactly: `blog/index.ts` supplies
`blog/index.tsx`; `blog/main.ts` is the branch's server layout. `.tsx` modules
also execute during SSR, so they must not import server-only services or read
browser globals at module initialization.

### From Request to Navigation

1. A document request traverses Hono middleware. Juniper resolves route data,
   renders the matching React components, and sends HTML with hydration data.
2. The browser loads the root module, restores serialized data and registered
   context, and hydrates the HTML. Normal event handlers are available after
   hydration.
3. A client navigation loads the destination's lazy module and data. Server
   loaders run through HTTP requests, which still traverse Hono middleware. The
   current screen can remain visible until the destination is ready.

Keep a `useNavigation()` status in the root layout to acknowledge navigation
immediately. A destination's `HydrateFallback` cannot render before that
destination's module arrives. See
[pending navigation](routing.md#pending-navigation).

Use server middleware to enforce access to data. Client middleware can improve
navigation behavior, but callers can bypass the browser and send HTTP requests
directly. See [middleware](middleware.md) and
[context sharing](state-management.md).

## When to Use Juniper

Juniper is well-suited for:

- **Full-Stack Web Applications**: Applications that need both server-side logic
  and rich client-side interactivity.

- **Content-Heavy Sites**: Blogs, documentation sites, and marketing pages that
  benefit from SSR for SEO.

- **CRUD Applications**: Apps with forms, data fetching, and database
  interactions where actions simplify the workflow.

- **Applications Requiring Authentication**: The middleware system makes it easy
  to protect routes and share user context.

- **Projects Using Deno**: If you're already using Deno or want to leverage its
  security model, TypeScript support, and modern tooling.

Juniper may not be the best fit for:

- **Static Sites**: If you only need static HTML, consider a static site
  generator.

- **Single-Page Applications Without SSR**: If you don't need server-side
  rendering, a simpler client-only setup may suffice.

## Next Steps

**Next:** [Getting Started](getting-started.md) - Set up your first project

**Related topics:**

- [Routing](routing.md) - File-based routing and data loading
- [Tutorials](tutorials/README.md) - Step-by-step guides for building
  applications
