# Juniper Application

A web application built with [Juniper](https://github.com/udibo/juniper), a
React framework for Deno.

## Prerequisites

Ensure you have [Deno](https://deno.com/) installed (version 2.0 or later).

Verify your installation:

```bash
deno --version
```

## Installation

Install dependencies:

```bash
deno install
```

## Development

Start the development server with hot reload:

```bash
deno task dev
```

This will:

- Watch for file changes
- Automatically rebuild when files change
- Refresh the browser after rebuilds

Open http://localhost:8000 to see your application.

## Building and Serving

For manual build and serve (useful for testing production builds locally):

```bash
# Build for development
deno task build

# Serve in development mode
deno task serve
```

For production builds with optimizations:

```bash
# Build with production settings
deno task build:prod

# Serve with production settings
deno task serve:prod
```

## Testing

Run your test suite:

```bash
deno task test
```

Tests run on port 8100 by default so they don't conflict with the dev server.

## Code Quality

Check formatting, linting, and type errors:

```bash
deno task check
```

## Project Structure

```
├── deno.json           # Deno configuration and tasks
├── .env                # Development environment variables
├── .env.production     # Production environment variables
├── .env.test           # Test environment variables
├── main.ts             # Server entry point (auto-generated)
├── main.tsx            # Client entry point (auto-generated)
├── routes/             # Route files
│   ├── main.ts         # Root server route (Hono app)
│   ├── main.tsx        # Root layout component
│   └── index.tsx       # Home page (/)
└── public/             # Static assets
    └── build/          # Generated build output
```

## Learn More

- [Juniper Documentation](https://github.com/udibo/juniper/tree/main/docs)
- [Getting Started](https://github.com/udibo/juniper/blob/main/docs/getting-started.md)
- [API Reference](https://jsr.io/@udibo/juniper/doc)
