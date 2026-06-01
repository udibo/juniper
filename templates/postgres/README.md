# Juniper + PostgreSQL

A web application built with [Juniper](https://github.com/udibo/juniper), a
React framework for Deno, backed by PostgreSQL using
[Drizzle ORM](https://orm.drizzle.team/) and [Zod](https://zod.dev/) for
validation.

It ships with a small **guestbook** example (`/`) that demonstrates the full
loop: reading rows in a loader, writing them in an action, validating input with
Zod, and organizing queries behind a service module.

## Prerequisites

- [Deno](https://deno.com/) 2.0 or later (`deno --version`)
- [Docker](https://www.docker.com/) (for the local PostgreSQL database)

## Installation

Install dependencies:

```bash
deno install
```

## Database Setup

Start PostgreSQL and create the schema:

```bash
deno task docker:start   # Start the PostgreSQL container
deno task db:migrate     # Apply migrations to the dev and test databases
deno task db:seed        # (optional) Insert a couple example messages
```

The container's first start creates two databases — `app_dev` and `app_test`
(see [docker/postgres/init-db.sql](docker/postgres/init-db.sql)). Connection
strings live in `.env` (dev) and `.env.test` (test).

### Database Tasks

```bash
deno task docker:start   # Start PostgreSQL
deno task docker:stop    # Stop PostgreSQL
deno task db:generate    # Generate SQL migrations from schema changes
deno task db:migrate     # Apply migrations (dev + test)
deno task db:push        # Push schema directly, skipping migrations (dev + test)
deno task db:seed        # Seed the dev database
deno task db:studio      # Browse data in Drizzle Studio
deno task db:reset       # Drop and recreate the dev + test databases
```

After `db:reset`, the databases are empty — run `deno task db:migrate` (and
optionally `deno task db:seed`) again to recreate the schema.

**Schema change workflow:** edit [db/schema.ts](db/schema.ts) →
`deno task db:generate` → `deno task db:migrate`.

## Development

Start the development server with hot reload:

```bash
deno task dev
```

Open http://localhost:8000 to see the guestbook.

## Building and Serving

```bash
deno task build          # Build for development
deno task serve          # Serve in development mode
deno task build:prod     # Build with production settings
deno task serve:prod     # Serve with production settings
```

In production, set `DATABASE_URL` in the environment (or `.env.production`) to
point at your managed PostgreSQL instance.

## Testing

```bash
deno task test
```

Tests run on port 8100 and connect to the `app_test` database, so make sure
PostgreSQL is running and migrated (`deno task docker:start` then
`deno task db:migrate`) before running them.

Any test that triggers a query should call `await closeDb()` in an `afterAll`
hook (see [services/message.test.ts](services/message.test.ts)) to release the
connection pool and keep Deno's resource sanitizer happy.

## Code Quality

```bash
deno task check
```

## Project Structure

```
├── deno.json              # Deno configuration, tasks, and dependencies
├── build.ts               # Build config; ignores ./docker for the dev watcher
├── docker-compose.yml     # Local PostgreSQL service
├── drizzle.config.ts      # Drizzle Kit configuration (migrations)
├── .env / .env.test       # Environment variables (incl. DATABASE_URL)
├── db/
│   ├── schema.ts          # Drizzle table definitions
│   ├── mod.ts             # Database connection (drizzle + node-postgres)
│   ├── seed.ts            # Example seed script
│   └── drizzle/           # Generated migrations (do not edit by hand)
├── services/
│   └── message.ts         # Data-access functions + Zod validation
├── routes/
│   ├── main.tsx           # Root layout component
│   ├── main.ts            # Root server route (Hono app)
│   ├── index.tsx          # Guestbook page (/)
│   └── index.ts           # Guestbook loader + action (server-only)
└── public/                # Static assets
```

## Learn More

- [Juniper Documentation](https://github.com/udibo/juniper/tree/main/docs)
- [Database guide](https://github.com/udibo/juniper/blob/main/docs/database.md)
- [Drizzle ORM](https://orm.drizzle.team/)
