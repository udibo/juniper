# Introduction

## What is Juniper?

Juniper is a web framework for building React applications with Deno. It
combines the power of [Hono](https://hono.dev/) for server-side routing with
[React Router](https://reactrouter.com/) for client-side navigation, providing a
seamless full-stack development experience.

The framework uses file-based routing, making it easy to understand your
application's structure at a glance. Routes are organized as a tree of files and
directories, with each file representing a route in your application.

Juniper is built on modern web standards and leverages Deno's built-in
TypeScript support, security model, and tooling. It supports server-side
rendering (SSR) out of the box, ensuring fast initial page loads and excellent
SEO.

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

**Route Modules** Each route can export:

- `default` - The React component to render
- `loader` - A function to fetch data before rendering
- `action` - A function to handle form submissions
- `middleware` - Functions that run before loaders and actions
- `ErrorBoundary` - A component to display when errors occur
- `HydrateFallback` - A component to show during hydration

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

## Comparison with Other Frameworks

| Feature        | Juniper      | Fresh      | Next.js    | React Router         |
| -------------- | ------------ | ---------- | ---------- | -------------------- |
| Runtime        | Deno         | Deno       | Node.js    | Node.js/Deno         |
| Routing        | File-based   | File-based | File-based | File-based or config |
| SSR            | Yes          | Yes        | Yes        | Yes (Framework Mode) |
| Server Actions | Yes          | No         | Yes        | Yes                  |
| Middleware     | Hono + Route | Fresh      | Next.js    | React Router         |
| Islands        | No           | Yes        | Partial    | No                   |
| TypeScript     | Native       | Native     | Configured | Configured           |

**vs Fresh**: Fresh uses Preact and an "Islands" architecture where only
interactive components ship JavaScript. Juniper uses React and hydrates the
entire page, which is better for highly interactive applications.

**vs Next.js**: Next.js runs on Node.js and has a larger ecosystem. Juniper runs
on Deno, offering built-in TypeScript, a secure-by-default permissions model,
and simpler dependency management.

**vs React Router (Framework Mode)**: Juniper is built on React Router's data
APIs but adds Hono for the server layer, file-based route generation, and
Deno-specific tooling.

## Next Steps

**Next:** [Getting Started](getting-started.md) - Set up your first project

**Related topics:**

- [Routing](routing.md) - File-based routing and data loading
- [Tutorials](tutorials/README.md) - Step-by-step guides for building applications
