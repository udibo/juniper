---
title: CI/CD
last_verified: 2026-09-09
---

# CI/CD

## Overview

Juniper projects work seamlessly with continuous integration and deployment
pipelines. This guide covers setting up GitHub Actions for automated testing,
linting, and deployment.

## Juniper's compatibility checks

The framework's `.github/workflows/ci-cd.yml` runs tests on Ubuntu, macOS, and
Windows. Windows uses `setup-deno` with caching disabled. The matrix also builds
the minimal and Tailwind production applications, exercising real CLI builds and
CSS entries; a failed platform does not cancel the others. The database-backed
Postgres template remains a separate Ubuntu job.

Relative build entries such as `./main.css` resolve from the project root on
every platform, including directory names containing spaces. Run both
`deno task test` and `deno task build:prod:tailwindcss` when changing the
builder. The generic application CI example below is independent of this
framework matrix.

## GitHub Actions

### Workflow Configuration

Create a workflow file at `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  format-and-lint:
    name: Check formatting and lint
    runs-on: ubuntu-latest
    steps:
      - name: Clone repository
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true

      - name: Check formatting
        run: deno fmt --check

      - name: Lint source files
        run: deno lint

      - name: Check types
        run: deno check

  test:
    name: Run tests
    needs: [format-and-lint]
    runs-on: ubuntu-latest
    steps:
      - name: Clone repository
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true

      - name: Install dependencies
        run: deno install --frozen

      - name: Run tests
        run: deno task test

  build:
    name: Build application
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - name: Clone repository
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true

      - name: Install dependencies
        run: deno install --frozen

      - name: Build for production
        run: deno task build:prod
```

### Running Tests

Configure the test job to run on multiple platforms:

```yaml
test:
  name: Test on ${{ matrix.os }}
  needs: [format-and-lint]
  runs-on: ${{ matrix.os }}
  strategy:
    matrix:
      os: [ubuntu-latest, macos-latest, windows-latest]
  steps:
    - name: Clone repository
      uses: actions/checkout@v4

    - name: Setup Deno
      uses: denoland/setup-deno@v2
      with:
        deno-version: v2.x
        cache: true

    - name: Install dependencies
      run: deno install --frozen

    - name: Run tests with coverage (Ubuntu)
      if: matrix.os == 'ubuntu-latest'
      run: deno task test --coverage

    - name: Run tests (macOS/Windows)
      if: matrix.os != 'ubuntu-latest'
      run: deno task test --parallel
```

The `deno install` step ensures all npm dependencies are fully resolved before
tests start. On Windows, you may also need to disable Deno's cache in GitHub
Actions to avoid stale npm package data causing resolution failures.

Add test coverage reporting with Codecov:

```yaml
- name: Export LCOV
  if: matrix.os == 'ubuntu-latest'
  run: deno coverage --lcov --output=coverage/lcov.info coverage

- name: Upload coverage
  if: matrix.os == 'ubuntu-latest'
  uses: codecov/codecov-action@v5
  with:
    fail_ci_if_error: true
    files: coverage/lcov.info
  env:
    CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

The report path must match the test task's working directory. In Juniper's
repository, the root test task delegates to `src/`, so its coverage directory is
`src/coverage/`; in a standalone template it is `coverage/`. Run the export and
upload against the same directory. Commit the lockfile and use
`deno install --frozen` in CI to reject dependency drift.

### Type Checking

Add a type checking step:

```yaml
type-check:
  name: Type check
  runs-on: ubuntu-latest
  steps:
    - name: Clone repository
      uses: actions/checkout@v4

    - name: Setup Deno
      uses: denoland/setup-deno@v2
      with:
        deno-version: v2.x
        cache: true

    - name: Install dependencies
      run: deno install --frozen

    - name: Check types
      run: deno check
```

### Linting and Formatting

Create a combined check task in `deno.json`:

```json
{
  "tasks": {
    "check": {
      "description": "Check formatting, lint, and types",
      "command": "deno check && deno lint && deno fmt --check"
    }
  }
}
```

Then use it in your workflow:

```yaml
- name: Run all checks
  run: deno task check
```

## Building for Production

Add a build job for production:

```yaml
build:
  name: Build for production
  needs: [test]
  runs-on: ubuntu-latest
  steps:
    - name: Clone repository
      uses: actions/checkout@v4

    - name: Setup Deno
      uses: denoland/setup-deno@v2
      with:
        deno-version: v2.x
        cache: true

    - name: Install dependencies
      run: deno install --frozen

    - name: Build application
      run: deno task build:prod

    - name: Upload build artifacts
      uses: actions/upload-artifact@v4
      with:
        name: build
        path: public/build/
```

## Deployment Pipelines

### Deploy to Deno Deploy

Deno Deploy can build and deploy a connected repository. Keep the CI build as a
validation gate even when the platform performs a separate deployment build.

See [Deployment](deployment.md#deno-deploy) for complete setup instructions.

### Deploy to Deno Deploy Classic

For Deno Deploy Classic, add automatic deployment via GitHub Actions:

```yaml
deploy:
  name: Deploy to Deno Deploy Classic
  needs: [build]
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  permissions:
    id-token: write
    contents: read
  steps:
    - name: Clone repository
      uses: actions/checkout@v4

    - name: Setup Deno
      uses: denoland/setup-deno@v2
      with:
        deno-version: v2.x
        cache: true

    - name: Build for production
      run: deno task build:prod

    - name: Deploy to Deno Deploy Classic
      uses: denoland/deployctl@v1
      with:
        project: my-juniper-app
        entrypoint: main.ts
```

### Deploy with Docker

Build and push a Docker image. See [Deployment](deployment.md#docker) for
Dockerfile examples.

```yaml
deploy-docker:
  name: Build and push Docker image
  needs: [test]
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  permissions:
    contents: read
    packages: write
  steps:
    - name: Clone repository
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Login to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Build and push
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ghcr.io/${{ github.repository }}:latest
```

## Example Complete Workflow

Here's a complete CI/CD workflow. Keep its check, test, and build jobs for
validation. Replace the deploy job with your platform's delivery step, and
require the validation jobs before promoting a revision to production.

This example includes the `build` and `deploy` jobs for Deno Deploy Classic:

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    name: Format and lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true
      - run: deno fmt --check
      - run: deno lint
      - run: deno check

  test:
    name: Test
    needs: [check]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true
      - run: deno install --frozen
      - run: deno task test --coverage
      - run: deno coverage --lcov --output=coverage/lcov.info coverage
      - uses: codecov/codecov-action@v5
        with:
          files: coverage/lcov.info
        env:
          CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}

  build:
    name: Build
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true
      - run: deno install --frozen
      - run: deno task build:prod
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: public/build/

  deploy:
    name: Deploy to Deno Deploy Classic
    needs: [build]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
          cache: true
      - run: deno install --frozen
      - run: deno task build:prod
      - uses: denoland/deployctl@v1
        with:
          project: my-juniper-app
          entrypoint: main.ts
```

## Next Steps

**Next:** [Deployment](deployment.md) - Deploy to Deno Deploy, Docker, and more

**Related topics:**

- [Testing](testing.md) - Testing utilities and patterns
- [Configuration](configuration.md) - Project and build configuration

## Changelog

- **2026-09-09** — Added explicit type and LCOV checks, frozen dependency
  installation, registry permissions, and deployment validation guidance.

- **2026-09-05** — Tailwind build and dev permission profiles allow only the
  `osRelease` system query needed by jiti's Windows terminal-color detection.
  Reproduce CI builds without `NO_COLOR` or `TERM=dumb`, which bypass that
  query.
- **2026-09-05** — Documented platform coverage and production-build checks for
  Windows CSS entry failures.
