# Static Files

The builder and dev server treat the `public/` directory as the origin for every
asset that is not handled by Hono or React Router. This guide explains how files
map to URLs, what the build step emits, and how to tailor caching for
production.

## Directory layout

```
public/
├── build/            # Generated bundles (main.js, chunks, CSS)
├── favicon.ico
├── images/
│   └── logo-81x100.png
└── robots.txt
```

- Files in `public/` are served verbatim at the root of your app
  (`/favicon.ico`, `/robots.txt`).
- The builder writes hashed assets into `public/build` and references them from
  the generated HTML via `<script type="module" src="/build/main.js">`.
- You may keep long-lived marketing assets alongside the bundles; the dev server
  automatically reloads when anything changes.

## Generated assets

During `deno task build`, `Builder.build()` invokes esbuild with
`splitting: true`, `treeShaking: true`, and React Compiler support. Outputs
include:

- `public/build/main.js` - entry bundle that imports the generated `client` and
  bootstraps hydration.
- `public/build/*.js` - code-split chunks for lazy routes.
- `public/build/*.css` - optional stylesheet outputs if you add CSS entry
  points.

Because the generated `main.ts` references `client` via
`import { client } from "./main.tsx";` and the server injects `/build/main.js`,
you typically commit the bundles alongside source. Doing so avoids requiring the
builder during production deploys.

## Custom entry points

Use the `entryPoints` option when instantiating your `Builder` to include
stylesheets or workers:

```ts
export const builder = new Builder({
  projectRoot,
  entryPoints: ["./styles/global.css", "./workers/email.ts"],
});
```

Each entry point is emitted into `public/build` and can be referenced from React
layouts:

```tsx
// routes/main.tsx
export default function Main() {
  return (
    <>
      <link rel="stylesheet" href="/build/global.css" />
      <Outlet />
    </>
  );
}
```

## Caching strategy

- **Bundled assets** – Because filenames are hashed, you can cache `/build/*.js`
  and `/build/*.css` with `Cache-Control: public, max-age=31536000, immutable`.
  Serve them through a CDN whenever possible.
- **Static files** – Assets outside `build/` (images, icons) should use etags or
  shorter TTLs if they change frequently.
- **Service workers** – If you add worker entry points, remember to scope them
  under the correct path and update the cache manifest after each build.

The server currently streams responses via `renderToReadableStream`. If you need
to inject cache headers globally, do so in `routes/main.ts` before handing off
to React Router.

## Dev vs. production

| Environment                               | Behavior                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Development (`deno task dev`)             | Bundles are rebuilt incrementally. `public/dev-client.js` opens an EventSource connection to request reloads. |
| Production build (`deno task build-prod`) | Assets are minified, sourcemaps are disabled, and no dev client is injected.                                  |

If you see 404s for `/build/main.js` while running `deno task serve`, ensure you
ran `deno task build` first and committed the resulting files.

## Troubleshooting

- **Missing `build` directory** – Run `deno task build` and ensure the
  permission profile allows writing to `public/build`.
- **Stale assets after deploy** – Double-check your CDN invalidation strategy or
  reference hashed filenames instead of fixed names.
- **Incorrect MIME types** – Hono infers content types from file extensions.
  Keep CSS/JS file extensions intact; avoid query-string cache busting because
  static serving is path-based.

## Next steps

- Continue with [Metadata](metadata.md) to understand how to link generated
  assets into your layouts.
- Review [CI/CD](ci-cd.md) for guidance on caching `public/build` between
  pipeline stages.
