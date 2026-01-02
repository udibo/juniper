# Development Tools

## Development Server

Juniper provides a development server with hot reload capabilities. Start it
with:

```bash
deno task dev
```

The development server:

- Watches for file changes
- Automatically rebuilds the application
- Notifies connected browsers to reload
- Runs your application in a managed child process

### Hot Reload

When you save a file, the development server automatically:

1. Detects the file change
2. Rebuilds only the necessary parts (server, client, or both)
3. Restarts the application server
4. Sends a reload signal to connected browsers via Server-Sent Events (SSE)

The browser receives the reload signal through a development client script
that's automatically injected in development mode.

### File Watching

The development server watches your project directory for changes. By default,
it ignores:

- Files in `public/build/` (generated output)
- Files containing `.test.` (test files)
- Temporary files (`.tmp`, `.lock`, `.log`, `~`)
- Build configuration files (`build.ts`, `dev.ts`)

**Note:** Files starting with `_` (like `routes/_utils.ts`) are not treated as
routes, but changes to them will still trigger rebuilds since they may be
imported by route files.

You can customize which paths are watched using the `watchPaths` option in your
build configuration:

```typescript
// build.ts
export const builder = new Builder({
  projectRoot,
  watchPaths: ["./routes", "./components", "./utils"],
});
```

## Deno Tasks

Juniper projects use Deno tasks for common operations. These are defined in your
`deno.json`:

| Task                   | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `deno task dev`        | Start the development server with hot reload    |
| `deno task build`      | Build the application for development           |
| `deno task build:prod` | Build the application for production            |
| `deno task serve`      | Run the built application                       |
| `deno task serve:prod` | Run the production build                        |
| `deno task test`       | Run tests                                       |
| `deno task check`      | Run type checking, linting, and format checking |

**Example task configuration:**

```json
{
  "tasks": {
    "dev": "deno run -A @udibo/juniper/dev --project-root .",
    "build": "deno run -A ./build.ts",
    "build:prod": "export APP_ENV=production && deno run -A ./build.ts",
    "serve": "deno run -A --env-file ./main.ts",
    "serve:prod": "deno run -A --env-file --env-file=.env.production ./main.ts",
    "test": "deno test -A --env-file --env-file=.env.test",
    "check": "deno check && deno lint && deno fmt --check"
  }
}
```

## Debugging

### Server-Side Debugging

Use Deno's built-in debugger with the `--inspect` or `--inspect-brk` flags:

```bash
# Start with debugger (doesn't wait)
deno run --inspect -A ./main.ts

# Start and wait for debugger to connect
deno run --inspect-brk -A ./main.ts
```

Connect using Chrome DevTools:

1. Open `chrome://inspect` in Chrome
2. Click "Configure" and add `localhost:9229`
3. Your Deno process should appear under "Remote Target"
4. Click "inspect" to open DevTools

Or use VS Code's built-in debugger (see IDE Integration below).

### Console Logging

Use `console.log` for debugging. The Hono logger middleware logs all requests:

```typescript
// routes/main.ts
import { Hono } from "hono";
import { logger } from "hono/logger";

const app = new Hono();
app.use(logger()); // Logs all requests

export default app;
```

### Error Stack Traces

In development, Juniper preserves error stack traces and includes them in error
responses. The `HttpError` class supports an `expose` option to control what
information is shown to users:

```typescript
import { HttpError } from "@udibo/juniper";

throw new HttpError(500, "Internal error details", {
  expose: false, // Don't expose this message to users
  exposedMessage: "Something went wrong", // Show this instead
});
```

## Browser DevTools

### React Developer Tools

Install the
[React Developer Tools](https://react.dev/learn/react-developer-tools) browser
extension to:

- Inspect the React component tree
- View and edit component props and state
- Profile component render performance
- Debug component hierarchies

### Network Tab

Use the browser's Network tab to:

- Monitor API requests and responses
- Debug loader and action data
- Check for failed requests
- Analyze request timing

### Source Maps

In development, Juniper generates source maps for easier debugging. You can:

- Set breakpoints in your TypeScript source files
- Step through original code (not bundled output)
- View original variable names and function names

Source maps are disabled in production for smaller bundle sizes.

## IDE Integration

### VS Code

**Recommended Extensions:**

- [Deno](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno) -
  Official Deno extension for IntelliSense, linting, and formatting

**Enable Deno for your workspace:**

Create `.vscode/settings.json`:

```json
{
  "deno.enable": true,
  "deno.lint": true,
  "deno.unstable": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "denoland.vscode-deno"
}
```

**Debugging configuration:**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Deno: Run",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "deno",
      "runtimeArgs": ["run", "-A", "--inspect-brk", "./main.ts"],
      "attachSimplePort": 9229
    },
    {
      "name": "Deno: Test",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "deno",
      "runtimeArgs": ["test", "-A", "--inspect-brk"],
      "attachSimplePort": 9229
    }
  ]
}
```

**Tasks configuration:**

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev",
      "type": "shell",
      "command": "deno task dev",
      "problemMatcher": [],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "test",
      "type": "shell",
      "command": "deno task test",
      "problemMatcher": [],
      "group": "test"
    }
  ]
}
```

### JetBrains

JetBrains IDEs (WebStorm, IntelliJ IDEA) have built-in Deno support:

1. Go to **Settings/Preferences > Languages & Frameworks > Deno**
2. Check **Enable Deno for this project**
3. Set the Deno executable path if not auto-detected

**Run Configurations:**

1. Go to **Run > Edit Configurations**
2. Add a new **Deno** configuration
3. Set the script to `main.ts`
4. Add arguments: `-A --env-file`

**Debugging:**

1. Create a Deno run configuration
2. Add `--inspect-brk` to the arguments
3. Set breakpoints in your code
4. Click the Debug button

## Next Steps

**Next:** [Routing](routing.md) - File-based routing and data loading

**Related topics:**

- [Testing](testing.md) - Testing utilities and patterns
- [Logging](logging.md) - Logging and OpenTelemetry
