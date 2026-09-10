# Tutorials

This section provides hands-on tutorials for learning Juniper. Each tutorial
walks you through building an application that demonstrates key framework
concepts.

> **Note:** These tutorials focus on teaching Juniper fundamentals. The
> resulting applications are not production-ready and lack important features
> like authentication. See the "Next Steps" section in each tutorial for
> guidance on what to add before deploying to production.

## Available Tutorials

### [Building a Blog Application](blog.md)

Learn core Juniper concepts by building a blog:

- File-based routing
- Server loaders and actions
- Form handling and validation
- API endpoints
- Deno KV for data storage
- Error handling

**Difficulty:** Beginner to Intermediate

**Scope:** The tutorial demonstrates validation of form fields. It does not
implement authentication or authorization; its create, edit, delete, and API
operations are public. Before using it with real data, enforce access in server
middleware and services, then test rejected HTTP requests as well as the UI.

## Getting the Tutorial Code

Each tutorial includes working code that you can clone and run locally. The
tutorial code is available in the Juniper repository under the `tutorials`
directory:

```bash
# Clone just the blog tutorial
deno run -A npm:degit udibo/juniper/tutorials/blog my-blog
cd my-blog
deno install
deno task dev
```

This gives you the finished result so you can explore the code or use it as a
starting point for your own project.

The finished code and prose should be read from the same revision when comparing
them. In a repository checkout, run `deno task test:blog` from the repository
root; in the copied tutorial project, run `deno task test`. See
[testing](../testing.md) for loader and form interaction examples.

## Next Steps

**Related topics:**

- [Getting Started](../getting-started.md) - Set up your development environment
- [Routing](../routing.md) - File-based routing and data loading
- [Forms](../forms.md) - Form handling and actions
- [Middleware](../middleware.md) - Adding authentication and other middleware
