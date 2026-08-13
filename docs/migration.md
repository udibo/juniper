# Migration Guide

## Overview

Juniper provides a CLI tool to help migrate existing React Router applications to Juniper. The tool automatically detects your routes and middleware, presents findings for confirmation, and generates Juniper-compatible route files.

## Usage

```bash
deno run -A @udibo/juniper/migrate [OPTIONS] <source>
```

### Options

- `--source <path>` - Source directory to scan (default: current directory)
- `--target <path>` - Target directory for Juniper routes (default: ./routes)
- `--dry-run` - Preview changes without writing files
- `--yes, -y` - Skip confirmation prompts
- `--help, -h` - Show help message

## Examples

### Basic Migration

Scan the current directory and generate Juniper routes:

```bash
deno run -A @udibo/juniper/migrate
```

### Scan Specific Directory

```bash
deno run -A @udibo/juniper/migrate --source ./my-react-app
```

### Preview Changes

See what would be generated without writing files:

```bash
deno run -A @udibo/juniper/migrate --dry-run
```

### Automated Migration

Skip confirmations for CI/CD pipelines:

```bash
deno run -A @udibo/juniper/migrate --yes --target ./src/routes
```

## What Gets Detected

The migration tool scans for:

### 1. React Router Configurations

- `createBrowserRouter` calls
- `createMemoryRouter` calls
- `createHashRouter` calls
- `createStaticRouter` calls

Example detection:
```typescript
// Source
const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    loader: homeLoader,
  },
  {
    path: "/about",
    element: <About />,
  },
]);
```

### 2. Middleware Exports

Detects middleware from React Router apps:

```typescript
// Source
export const middleware: MiddlewareFunction[] = [
  async ({ request }, next) => {
    console.log(request.url);
    return next();
  }
];
```

The tool will:
- Detect middleware exports
- Preserve middleware logic
- Generate Juniper-compatible middleware files
- Place them in `_middleware/` directory

### 3. Loaders and Actions

```typescript
// Source
export async function loader({ params }) {
  return fetchUser(params.id);
}

export async function action({ request }) {
  const data = await request.formData();
  return updateUser(data);
}
```

### 4. File-Based Routes

If no explicit router config is found, the tool scans for common route directories:
- `routes/`
- `pages/`
- `src/routes/`
- `src/pages/`

And converts file paths to routes:
- `routes/index.tsx` → `/`
- `routes/about.tsx` → `/about`
- `routes/blog/[id].tsx` → `/blog/:id`

## Generated Output

### Route Files

For each detected route, a Juniper route file is generated:

```typescript
// routes/about/index.tsx (generated)
import type { RouteProps, RouteLoaderArgs } from "@udibo/juniper";

export async function loader({ params, request }: RouteLoaderArgs) {
  // TODO: Migrate loader logic from aboutLoader
  return { message: "Loaded data for /about" };
}

export default function AboutRoute({ loaderData }: RouteProps) {
  return (
    <div>
      <h1>/about Route</h1>
      <p>This route was auto-generated from React Router config.</p>
      {loaderData && <pre>{JSON.stringify(loaderData, null, 2)}</pre>}
    </div>
  );
}
```

### Middleware Files

Middleware is extracted to a `_middleware` directory:

```typescript
// routes/_middleware/auth.ts (generated)
import type { MiddlewareFunction } from "@udibo/juniper";

export const authMiddleware: MiddlewareFunction = async ({ context, request }, next) => {
  // TODO: Migrate middleware logic
  console.log("Middleware for /protected");
  return next();
};
```

### Main Layout

A `main.tsx` file is generated if it doesn't exist:

```typescript
// routes/main.tsx (generated)
import { Outlet } from "react-router";
import type { ErrorBoundaryProps } from "@udibo/juniper";

export default function Main() {
  return (
    <main>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <Outlet />
    </main>
  );
}

export function ErrorBoundary({ error, resetErrorBoundary }: ErrorBoundaryProps) {
  // Error boundary implementation
}
```

## Migration Workflow

1. **Scan**: The tool scans your React Router app
2. **Detect**: Finds routes, loaders, actions, and middleware
3. **Review**: Presents findings for your confirmation
4. **Generate**: Creates Juniper route files
5. **Refine**: You review and customize the generated files

## Post-Migration Steps

After running the migration tool:

1. **Review Generated Files**
   ```bash
   ls -la routes/
   ```

2. **Update Loaders and Actions**
   - Replace TODO comments with actual logic
   - Adapt to Juniper's loader/action API
   - Use `serverLoader` for server-side data fetching

3. **Test the Application**
   ```bash
   deno task dev
   ```

4. **Refine Middleware**
   - Check `_middleware/` directory
   - Ensure middleware works with Juniper's context API
   - Test client-side navigation

5. **Update Build Configuration**
   ```typescript
   // build.ts
   import { Builder } from "@udibo/juniper/build";
   
   export const builder = new Builder({
     // Your config
   });
   ```

## Handling Complex Cases

### Nested Routes

React Router nested routes are converted to Juniper's file-based structure:

```typescript
// React Router
{
  path: "/blog",
  element: <BlogLayout />,
  children: [
    { index: true, element: <BlogIndex /> },
    { path: ":id", element: <BlogPost /> }
  ]
}
```

Becomes:
```
routes/
  blog/
    main.tsx      # BlogLayout
    index.tsx     # BlogIndex
    [id]/
      index.tsx   # BlogPost
```

### Middleware Migration

React Router middleware works directly in Juniper (no changes needed):

```typescript
// Works in both React Router and Juniper
import type { MiddlewareFunction } from "react-router";

export const myMiddleware: MiddlewareFunction = async ({ request }, next) => {
  // Your logic
  return next();
};
```

### Data Loading

Update loaders to use Juniper's API:

```typescript
// React Router
export async function loader({ params }) {
  return fetch(`/api/users/${params.id}`);
}

// Juniper
export async function loader({ params, serverLoader }: RouteLoaderArgs) {
  // Option 1: Use serverLoader for server-side data
  const data = await serverLoader();
  
  // Option 2: Direct fetch (runs on both client and server)
  const user = await fetchUser(params.id);
  return { user };
}
```

## Limitations

The migration tool has some limitations:

1. **Dynamic Routes**: May need manual adjustment for complex patterns
2. **Custom History**: Browser history is handled automatically by Juniper
3. **Server-Side Rendering**: Juniper uses Hono for SSR (different from RR)
4. **Data Router Features**: Some advanced RR features may need manual porting

## Troubleshooting

### No Routes Detected

If no routes are detected:
- Ensure your app uses `createBrowserRouter` or similar
- Check that route files are in expected locations
- Try specifying the source directory explicitly
- Use `--dry-run` to see what's being scanned

### Generated Files Need Adjustment

The tool generates starter files with TODOs. You'll need to:
- Replace placeholder logic with actual implementation
- Adjust imports
- Test thoroughly
- Refine middleware for Juniper's context API

### Middleware Not Working

If migrated middleware doesn't work:
- Check that it uses RR-compatible API (should work directly)
- Verify `next()` is called and its result is returned
- Test with simple middleware first
- Check browser console for errors

## Getting Help

For issues with migration:
1. Check the generated files for TODOs
2. Review Juniper's middleware documentation
3. Compare with example apps in the repository
4. Open an issue with your source code structure
