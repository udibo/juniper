# Juniper

[![JSR](https://jsr.io/badges/@udibo/juniper)](https://jsr.io/@udibo/juniper)
[![CI/CD](https://github.com/udibo/juniper/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/udibo/juniper/actions/workflows/ci-cd.yml)
[![codecov](https://codecov.io/gh/udibo/juniper/graph/badge.svg?token=ZXCYCMUQ34)](https://codecov.io/gh/udibo/juniper)
[![license](https://img.shields.io/github/license/udibo/juniper)](https://github.com/udibo/juniper/blob/main/LICENSE)

<img align="left" src="example/public/images/logo-81x100.png" alt="Juniper Logo" width="81" height="100" style="margin: 0 20px 10px 0;">

Juniper is a web framework for building React applications with Deno. It
combines [Hono](https://hono.dev/) for server-side routing with
[React Router](https://reactrouter.com/) for client-side navigation, providing a
seamless full-stack development experience.

<br clear="left">

## Features

- **File-Based Routing** - Create routes by adding files to your `routes`
  directory. The file structure directly maps to your URL structure.
- **Server-Side Rendering** - React components render on the server for fast
  initial page loads and SEO benefits.
- **Data Loading and Actions** - Fetch data with loaders and handle form
  submissions with actions, on either server or client.
- **Hot Reload** - See changes instantly during development.
- **TypeScript First** - Full TypeScript support with type-safe route
  parameters, loader data, and action data.
- **React 19 Support** - Built for React 19, including native document metadata
  support.
- **Hono Middleware** - Use Hono's extensive middleware ecosystem for
  authentication, logging, CORS, and more.
- **Error Boundaries** - Graceful error handling with route-level and root error
  boundaries.
- **Code Splitting** - Automatic code splitting for routes, loading only the
  code needed for each page.

## Quick Start

Use `degit` to clone a template and get started:

```bash
# Minimal template
deno run -A npm:degit udibo/juniper/templates/minimal my-app
cd my-app
deno install
deno task dev
```

Or with TailwindCSS:

```bash
deno run -A npm:degit udibo/juniper/templates/tailwindcss my-app
cd my-app
deno install
deno task dev
```

Open your browser to `http://localhost:8000` to see your application.

## Example

```tsx
// routes/index.tsx
export default function Home() {
  return (
    <>
      <title>Home</title>
      <h1>Welcome to Juniper</h1>
    </>
  );
}
```

```typescript
// routes/blog/[id].ts
import { HttpError } from "@udibo/juniper";
import type { RouteLoaderArgs } from "@udibo/juniper";

export async function loader({ params }: RouteLoaderArgs<{ id: string }>) {
  const post = await getPost(params.id);
  if (!post) {
    throw new HttpError(404, "Post not found");
  }
  return { post };
}
```

```tsx
// routes/blog/[id]/index.tsx
import type { RouteProps } from "@udibo/juniper";

export default function BlogPost({ loaderData }: RouteProps) {
  return (
    <>
      <title>{loaderData.post.title}</title>
      <article>
        <h1>{loaderData.post.title}</h1>
        <p>{loaderData.post.content}</p>
      </article>
    </>
  );
}
```

## Documentation

Comprehensive guides for using the framework:

### Getting Started

- [Introduction](docs/introduction.md) - Overview and key concepts
- [Getting Started](docs/getting-started.md) - Set up your first project
- [Configuration](docs/configuration.md) - Project and build configuration
- [Development Tools](docs/development-tools.md) - Hot reload and debugging

### Core Concepts

- [Routing](docs/routing.md) - File-based routing and data loading
- [Middleware](docs/middleware.md) - Server and client middleware
- [Forms](docs/forms.md) - Form handling with client and server actions
- [State Management](docs/state-management.md) - Sharing data across your app
- [Error Handling](docs/error-handling.md) - Error boundaries and HttpError

### Styling & Assets

- [Styling](docs/styling.md) - CSS and TailwindCSS integration
- [Static Files](docs/static-files.md) - Serving static assets
- [Metadata](docs/metadata.md) - Page titles and meta tags

### Data & Backend

- [Database](docs/database.md) - Deno KV and other databases

### Testing & Deployment

- [Testing](docs/testing.md) - Testing utilities and patterns
- [Logging](docs/logging.md) - Logging and OpenTelemetry
- [CI/CD](docs/ci-cd.md) - GitHub Actions workflows
- [Deployment](docs/deployment.md) - Deploy to Deno Deploy, Docker, and more

### Tutorials

- [Tutorials](docs/tutorials/README.md) - Step-by-step guides for building applications

### API Reference

The API documentation is available on JSR:
[@udibo/juniper](https://jsr.io/@udibo/juniper/doc)

## Contributing

Contributions are welcome! Please read the [contributing guide](CONTRIBUTING.md)
before submitting a pull request.

## License

MIT License - see [LICENSE](LICENSE) for details.
