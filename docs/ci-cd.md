# CI/CD

## Overview

Juniper projects work seamlessly with continuous integration and deployment
pipelines. This guide covers setting up GitHub Actions for automated testing,
linting, and deployment.

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
        run: deno install

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
        run: deno install

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
      run: deno install

    - name: Run tests with coverage (Ubuntu)
      if: matrix.os == 'ubuntu-latest'
      run: deno task test --coverage

    - name: Run tests (macOS)
      if: matrix.os == 'macos-latest'
      run: deno task test --parallel

    - name: Run tests (Windows)
      if: matrix.os == 'windows-latest'
      run: deno task test
```

**Important:** Tests run sequentially on Windows (without `--parallel`) because
parallel test execution can cause npm package resolution failures due to Windows
file system timing issues. The `deno install` step ensures all dependencies are
resolved before tests start.

Add test coverage reporting with Codecov:

```yaml
- name: Upload coverage
  if: matrix.os == 'ubuntu-latest'
  uses: codecov/codecov-action@v5
  with:
    fail_ci_if_error: true
    files: coverage/lcov.info
  env:
    CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

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
      run: deno install

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
      run: deno install

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

Deno Deploy is the recommended platform for deploying Juniper applications. It
handles building and deployment automatically through its dashboard.

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

Here's a complete CI/CD workflow. If you're using Deno Deploy (recommended), you
can omit the `build` and `deploy` jobs since Deno Deploy handles building and
deployment automatically when you push to your configured branch.

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
      - run: deno install
      - run: deno task test --coverage
      - uses: codecov/codecov-action@v5
        with:
          files: coverage/lcov.info
        env:
          CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}

  # Omit build and deploy jobs if using Deno Deploy (not Classic)
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
      - run: deno install
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
      - run: deno install
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
