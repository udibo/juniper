# Juniper CLI

The Juniper CLI provides tools for detecting and migrating routes and middleware in your projects.

## Installation

The CLI is included with Juniper and can be run directly:

```bash
deno run -A @udibo/juniper/cli [command] [options]
```

## Commands

### `detect`

Detects routes and middleware in your project.

```bash
deno run -A @udibo/juniper/cli detect [options]
```

**Options:**
- `-p, --project-root <path>` - Project root directory (default: current directory)
- `-r, --routes-dir <path>` - Routes directory (default: `./routes`)

**Example Output:**
```
📊 Route Detection Results
=========================

Total routes found: 91
Routes with middleware: 3
React Router routes: 9
Juniper routes: 66

Routes:
-------
  / -> index.tsx (juniper)
  /dashboard -> dashboard.tsx (react-router) [middleware: 1]
  /blog/:id -> blog/[id]/index.tsx (juniper) [middleware: 2]
```

### `migrate`

Detects and migrates React Router routes to Juniper format.

```bash
deno run -A @udibo/juniper/cli migrate [options]
```

### `generate adapter`

Generates boilerplate middleware adapters.

```bash
deno run -A @udibo/juniper/cli generate adapter <type> <name> [output]
```

**Available Types:**
- `auth`: `requireAuth`, `optionalAuth`, `requireRole`
- `logging`: `requestLogger`, `performanceMonitor`
- `error`: `errorBoundary`, `requireContext`
- `security`: `cors`, `rateLimit`
- `context`: `setContext`, `mergeContext`

**Example:**
```bash
# Generate auth middleware
deno run -A @udibo/juniper/cli generate adapter auth requireAuth ./middleware/auth.ts

# Generate logging middleware
deno run -A @udibo/juniper/cli generate adapter logging requestLogger
```

**Options:**
- `-p, --project-root <path>` - Project root directory (default: current directory)
- `-r, --routes-dir <path>` - Routes directory (default: `./routes`)
- `-d, --dry-run` - Show what would be migrated without making changes
- `-y, --yes` - Skip confirmation prompts

**What it does:**
1. Scans for React Router routes
2. Displays what it found
3. Asks for user confirmation (unless `--yes` is used)
4. Migrates the routes to Juniper format

**Example:**
```bash
# Preview what would be migrated
deno run -A @udibo/juniper/cli migrate --dry-run

# Migrate with confirmation
deno run -A @udibo/juniper/cli migrate

# Migrate without confirmation
deno run -A @udibo/juniper/cli migrate --yes
```

## Use Cases

### 1. Migrating from React Router to Juniper

If you have an existing React Router application and want to migrate to Juniper:

```bash
# First, see what routes will be detected
deno run -A @udibo/juniper/cli detect

# Preview the migration
deno run -A @udibo/juniper/cli migrate --dry-run

# Perform the migration
deno run -A @udibo/juniper/cli migrate
```

The CLI will:
- Detect all routes in your project
- Identify which ones use React Router vs Juniper
- Show you which routes have middleware, loaders, or actions
- Migrate React Router imports to Juniper imports

### 2. Auditing Middleware Usage

To understand what middleware exists in your project:

```bash
deno run -A @udibo/juniper/cli detect
```

Look for routes with `[middleware: N]` to see which routes have middleware and how many middleware functions they use.

### 3. Detecting Framework Mix

If you're unsure whether your project uses React Router or Juniper:

```bash
deno run -A @udibo/juniper/cli detect
```

The output will show:
- `React Router routes: N` - Routes using React Router
- `Juniper routes: N` - Routes using Juniper
- `Routes with middleware: N` - Routes that have middleware

## Migration Details

The migration tool performs the following transformations:

1. **Import Updates**: Changes `from "react-router"` to `from "@udibo/juniper"` for type imports
2. **Middleware Detection**: Identifies routes with middleware exports
3. **Route Analysis**: Detects loaders, actions, and middleware

**Note:** The migration is conservative and only makes safe changes. It will:
- Add Juniper imports where needed
- Preserve your existing middleware, loaders, and actions
- Not modify component code

**Manual steps required after migration:**
- Update your build configuration
- Ensure your routes follow Juniper's file-based routing conventions
- Test the migrated routes

## Examples

### Example 1: Basic Detection

```bash
$ deno run -A @udibo/juniper/cli detect

📊 Route Detection Results
=========================

Total routes found: 3
Routes with middleware: 1
React Router routes: 0
Juniper routes: 3

Routes:
-------
  / -> index.tsx (juniper)
  /about -> about.tsx (juniper)
  /dashboard -> dashboard.tsx (juniper) [middleware: 1]
```

### Example 2: Detecting React Router Routes

```bash
$ deno run -A @udibo/juniper/cli detect

📊 Route Detection Results
=========================

Total routes found: 5
Routes with middleware: 2
React Router routes: 3
Juniper routes: 2

Routes:
-------
  / -> index.tsx (juniper)
  /dashboard -> dashboard.tsx (react-router) [middleware: 1]
  /profile -> profile.tsx (react-router)
  /settings -> settings.tsx (juniper) [middleware: 2]
  /blog/:id -> blog/[id].tsx (react-router)
```

### Example 3: Migration Preview

```bash
$ deno run -A @udibo/juniper/cli migrate --dry-run

📊 Route Detection Results
=========================

Total routes found: 3
Routes with middleware: 1
React Router routes: 2
Juniper routes: 1

🔄 Migration Plan
================

Found 2 React Router routes to migrate:

  /dashboard (dashboard.tsx)
    - Has middleware (1 middleware)
  /profile (profile.tsx)

🔍 Dry run mode - no changes will be made

Would migrate the above routes to Juniper format.
```

### Example 4: Actual Migration

```bash
$ deno run -A @udibo/juniper/cli migrate

📊 Route Detection Results
=========================

Total routes found: 3
...

🔄 Migration Plan
================

Found 2 React Router routes to migrate:

  /dashboard (dashboard.tsx)
  /profile (profile.tsx)

Proceed with migration? (y/N): y

🚀 Starting migration...

✅ Migrated dashboard.tsx
✅ Migrated profile.tsx

✨ Migration complete!
```

## Troubleshooting

### No routes detected

If no routes are detected:
1. Check that your routes are in the correct directory (default: `./routes`)
2. Use `--routes-dir` to specify a different directory
3. Ensure your route files have `.tsx`, `.ts`, `.jsx`, or `.js` extensions

### Wrong framework detected

The CLI detects the framework based on imports:
- **Juniper**: Files containing `@udibo/juniper`
- **React Router**: Files containing `react-router`

If detection is incorrect, check your import statements.

### Migration doesn't change files

The migration tool is conservative and only makes safe changes. If no changes are detected:
1. Your routes might already be in Juniper format
2. The changes might be minimal (only import updates)
3. Use `--dry-run` to see what would be changed

## API

The CLI can also be used programmatically:

```typescript
import { detectRoutes, migrateRoutes } from "@udibo/juniper/cli";

const result = await detectRoutes("./my-project", "./routes");
console.log(`Found ${result.totalRoutes} routes`);

await migrateRoutes(result, {
  projectRoot: "./my-project",
  dryRun: true,
});
```

## Contributing

To add new detection or migration features, edit `src/cli.ts`. Tests are in `src/cli.test.ts`.
