# Contributing to Juniper

Thank you for your interest in contributing to Juniper! This document provides
guidelines and information for contributors.

## Code of Conduct

Please be respectful and inclusive in all interactions. We are committed to
providing a welcoming and harassment-free experience for everyone. Be kind,
constructive, and professional in your communications.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- [Deno](https://deno.com/) v2.x or later installed
- [Git](https://git-scm.com/) for version control
- A code editor (VS Code with the Deno extension is recommended)
- Docker (optional, for OpenTelemetry development)

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/juniper.git
   cd juniper
   ```

3. **Install dependencies:**
   ```bash
   deno install
   ```

4. **Run the example application:**
   ```bash
   deno task dev
   ```

5. **Run tests to verify your setup:**
   ```bash
   deno task test
   ```

### Repository Structure

```
juniper/
├── src/                    # Core framework source code
│   ├── mod.ts              # Main module exports
│   ├── build.ts            # Build system
│   ├── server.tsx          # Server-side rendering
│   ├── client.tsx          # Client-side hydration
│   ├── dev.ts              # Development server
│   └── utils/              # Utility modules
├── example/                # Example application
│   ├── routes/             # Route files
│   ├── services/           # Data services
│   └── components/         # Reusable components
├── templates/              # Project templates
│   ├── minimal/            # Minimal starter template
│   ├── tailwindcss/        # TailwindCSS template
│   └── tanstack/           # TanStack Query template
├── docs/                   # Documentation
├── deno.json               # Workspace configuration
└── CONTRIBUTING.md         # This file
```

## Development Workflow

### Running the Development Server

The repository uses a Deno workspace. Run the example application:

```bash
# Run the example in development mode
deno task dev

# Run a specific template in development mode
deno task dev:minimal
deno task dev:tailwindcss
deno task dev:tanstack
```

### Running Tests

```bash
# Run all Juniper core tests
deno task test

# Run example tests
deno task test:example

# Run template tests
deno task test:minimal
deno task test:tailwindcss
deno task test:tanstack

# Run tests with coverage
deno task test --coverage
```

### Type Checking and Linting

```bash
# Run all checks (type check, lint, format check)
deno task check

# Individual commands
deno check          # Type check
deno lint           # Lint
deno fmt --check    # Check formatting
deno fmt            # Auto-format
```

## Code Style

### TypeScript Guidelines

- Use TypeScript for all source files
- Prefer explicit types for function parameters and return types
- Use `interface` for object types, `type` for unions and intersections
- Avoid `any` - use `unknown` and narrow types when needed
- Use descriptive names for variables and functions

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string;
}

function getUser(id: string): Promise<User | null> {
  // implementation
}

// Avoid
function getUser(id: any): any {
  // implementation
}
```

### Import Organization

Organize imports in this order:

1. Standard library imports (`@std/*`)
2. Third-party imports (npm packages, JSR packages)
3. Internal framework imports (`@udibo/juniper/*`)
4. Relative imports (local files)

Use blank lines to separate groups:

```typescript
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { Hono } from "hono";
import React from "react";

import { HttpError } from "@udibo/juniper";

import { userService } from "./services/user.ts";
```

### Formatting

- Use Deno's built-in formatter: `deno fmt`
- Maximum line length: 80 characters (enforced by formatter)
- Use 2 spaces for indentation
- Always include trailing commas in multi-line arrays/objects

## Testing Guidelines

### Writing Tests

- Write tests for all new functionality
- Place test files next to the code they test with a `.test.ts` extension
- Use descriptive test names that explain what's being tested
- Test both success and error cases

```typescript
import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

import { myFunction } from "./my-function.ts";

describe("myFunction", () => {
  it("should return expected value for valid input", () => {
    const result = myFunction("valid");
    assertEquals(result, "expected");
  });

  it("should throw error for invalid input", () => {
    assertThrows(
      () => myFunction(""),
      Error,
      "Input cannot be empty",
    );
  });
});
```

### Test Organization

- Use `describe` blocks to group related tests
- Use `it` or `test` for individual test cases
- Use `beforeEach` and `afterEach` for setup/cleanup
- Keep tests focused and independent

### Mocking and Stubs

Use Deno's standard testing utilities:

```typescript
import { spy, stub } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";

describe("time-dependent tests", () => {
  it("should handle mocked time", () => {
    using time = new FakeTime();
    // Test with controlled time
    time.tick(1000);
  });
});
```

## Pull Request Process

### Branch Naming

Use descriptive branch names:

- `feature/add-user-authentication`
- `fix/loader-error-handling`
- `docs/update-routing-guide`
- `refactor/simplify-build-process`

### PR Title Convention (Required)

We use [Conventional Commits](https://www.conventionalcommits.org/) for PR
titles. When your PR is merged, the squash commit message will use your PR
title, so it must follow this format:

```
<type>(<scope>): <description>
```

**Types:**

| Type       | Description                                         | Version Bump |
| ---------- | --------------------------------------------------- | ------------ |
| `feat`     | A new feature                                       | Minor        |
| `fix`      | A bug fix                                           | Patch        |
| `docs`     | Documentation only changes                          | None         |
| `style`    | Code style changes (formatting, semicolons)         | None         |
| `refactor` | Code changes that neither fix bugs nor add features | None         |
| `perf`     | Performance improvements                            | Patch        |
| `test`     | Adding or updating tests                            | None         |
| `build`    | Build system or external dependency changes         | None         |
| `ci`       | CI configuration changes                            | None         |
| `chore`    | Other changes that don't modify src or test files   | None         |

**Scope** (optional): The area of the codebase affected (e.g., `router`,
`build`, `server`).

**Examples:**

```
feat: add server-side caching for loaders
fix(router): handle undefined params gracefully
docs: update installation instructions
feat!: change loader API signature
```

**Breaking Changes:**

For breaking changes, add `!` after the type/scope or include `BREAKING CHANGE:`
in the PR description body:

```
feat!: change loader return type to Response

BREAKING CHANGE: Loaders now return Response objects instead of plain data.
```

### Commit Messages

Individual commits within a PR don't need to follow the convention (they will be
squashed). Write clear, descriptive messages:

- Use present tense: "Add feature" not "Added feature"
- Start with a verb: "Fix", "Add", "Update", "Remove", "Refactor"
- Keep the subject line under 50 characters

### PR Description

Include in your pull request:

1. **Summary** - What does this PR do?
2. **Changes** - List of specific changes made
3. **Testing** - How was this tested?
4. **Related Issues** - Link to any related issues

### Review Process

1. Ensure all CI checks pass
2. Request review from maintainers
3. Address all feedback
4. Maintainer will merge when approved

## Architecture Overview

### Core Modules

- **mod.ts** - Main exports for the framework
- **build.ts** - esbuild configuration and bundle generation
- **server.tsx** - Server-side rendering and route handling
- **client.tsx** - Client-side hydration and routing
- **dev.ts** - Development server with hot reload

### Build System

The build system uses esbuild with the Deno plugin:

1. Scans the `routes/` directory for route files
2. Generates `main.ts` (server) and `main.tsx` (client) entry points
3. Bundles client code with code splitting
4. Outputs to `public/build/`

### Server/Client Split

Juniper uses a clear server/client separation:

- **Server routes** (`.ts` files) - Run only on the server
  - Loaders, actions, middleware
  - Direct database access
  - Secret/environment variable access

- **Client routes** (`.tsx` files) - Run on both server (SSR) and client
  - Loaders, actions, middleware
  - React components
  - Client-side navigation
  - Serializable data only

Data flows from server loaders to client components through serialization.

## Release Process

Releases are fully automated using
[semantic-release](https://github.com/semantic-release/semantic-release):

1. PRs are merged to `main` using squash merge
2. semantic-release analyzes commit messages (from PR titles)
3. Version is automatically determined based on commit types
4. CHANGELOG.md is updated automatically
5. Package is published to JSR
6. GitHub release is created with release notes

**Version bumps are determined by PR titles:**

- `fix:` → Patch release (0.1.x)
- `feat:` → Minor release (0.x.0)
- `feat!:` or `BREAKING CHANGE:` → Minor release during v0.x, Major after v1.0

## Getting Help

- **Issues** - Report bugs or request features on
  [GitHub Issues](https://github.com/udibo/juniper/issues)
- **Discussions** - Ask questions on
  [GitHub Discussions](https://github.com/udibo/juniper/discussions)
- **Documentation** - Check the [docs](docs/) folder

Thank you for contributing to Juniper!
