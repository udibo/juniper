# Static Files

## Public Directory

The `public` directory serves static files directly to clients. Place assets
like images, fonts, and favicons here:

```
my-app/
├── public/
│   ├── favicon.ico
│   ├── robots.txt
│   ├── images/
│   │   └── logo.png
│   └── fonts/
│       └── inter.woff2
```

Access these files from your components using absolute paths:

```tsx
export default function Header() {
  return (
    <header>
      <img src="/images/logo.png" alt="Logo" />
      <link rel="icon" href="/favicon.ico" />
    </header>
  );
}
```

## Serving Static Assets

Juniper automatically serves files from the `public` directory. The built-in
static file handler:

- Serves files with correct MIME types
- Supports range requests for video/audio streaming
- Returns 404 for missing files

For custom static file handling, configure it in your root Hono app:

```typescript
// routes/main.ts
import { Hono } from "hono";
import { serveStatic } from "hono/deno";

const app = new Hono();

// Serve static files from a custom directory
app.use("/assets/*", serveStatic({ root: "./custom-assets" }));

export default app;
```

## Build Output

The build system outputs bundled JavaScript and CSS to `public/build/`:

```
public/
├── build/
│   ├── main.js           # Main application bundle
│   ├── main.js.map       # Source map (dev only)
│   ├── main.css          # Bundled CSS
│   └── chunk-[hash].js   # Code-split chunks
```

Juniper includes the JavaScript entry in the SSR document; its imports load the
required chunks. Link stylesheet entry points explicitly from a layout:

```tsx
<link rel="stylesheet" href="/build/main.css" precedence="default" />;
```

**Don't edit files in `public/build/`** - they're regenerated on each build.

To exclude build output from version control, add to `.gitignore`:

```
public/build/
```

## Asset Optimization

### Images

For optimal image loading:

```tsx
// Use width and height to prevent layout shift
<img
  src="/images/hero.jpg"
  width={1200}
  height={600}
  alt="Hero image"
  loading="lazy" // Lazy load below-the-fold images
/>;
```

Consider using an image optimization service or CDN for production.

### Fonts

For custom fonts, use `@font-face` in your CSS:

```css
/* main.css */
@font-face {
  font-family: "Inter";
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  src: url("/fonts/inter-regular.woff2") format("woff2");
}

body {
  font-family: "Inter", system-ui, sans-serif;
}
```

Preload critical fonts for faster rendering:

```tsx
// routes/main.tsx
export default function Main() {
  return (
    <>
      <link
        rel="preload"
        href="/fonts/inter-regular.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <Outlet />
    </>
  );
}
```

### Bundle Size

The build system automatically:

- Minifies JavaScript and CSS in production
- Enables tree-shaking to remove unused code
- Splits code by route for lazy loading

Monitor bundle size with:

```bash
# Check build output sizes
ls -la public/build/
```

## Cache Headers

### Default Build Artifact Caching

Juniper automatically applies cache headers to build artifacts in `/build/`
based on whether the filename carries a content hash:

| File                                          | Cache-Control                                   | Reason                                                             |
| --------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| Fingerprinted (`name-XXXXXXXX.ext`)           | `public, max-age=14400` (4 hours)               | The hash in the filename changes whenever the content changes      |
| Everything else (`main.js`, `main.css`, etc.) | `private, no-cache, must-revalidate, max-age=0` | Stable URL, so every request revalidates against the current build |

Fingerprinted files are the lazy chunks and any esbuild output whose name ends
in a dash followed by an eight-character hash, including their source maps.
Everything else is treated as a stable URL: `main.js`, every entry point you
pass to the `Builder` (such as `main.css` or `styles/theme.css`), and their
source maps.

The rule is the filename, so do not name an entry point or a file you place in
`public/build` `<stem>-XXXXXXXX.<ext>` where the suffix is eight uppercase
letters or digits — `sw-REGISTER.js` and `Inter-VARIABLE.woff2` both read as
fingerprinted and would be cached for four hours under a URL that never changes.
Any other shape, `theme-dark.css` included, revalidates.

Stable URLs use `no-cache` with ETag validation because:

- Their filenames do not change between builds, so a long lifetime would let a
  browser pair new HTML and JavaScript with a stylesheet from a previous
  deployment
- CDNs and proxies should not cache them (hence `private`)
- Browsers still reuse their cached copy when the ETag matches, so revalidation
  costs a conditional request that returns `304 Not Modified` rather than a
  re-download

### Overriding Default Cache Headers

The framework sets cache headers _before_ your route handlers run, so you can
override them with your own middleware. For example, to extend caching for
fingerprinted build files:

```typescript
// routes/main.ts
import { Hono } from "hono";

const app = new Hono();

app.use("/build/*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  if (/-[A-Z0-9]{8}\.[A-Za-z0-9]+(?:\.map)?$/.test(pathname)) {
    c.header("Cache-Control", "public, max-age=31536000, immutable");
  }
  await next();
});

export default app;
```

**Why set headers before `next()`?** Setting cache headers before calling
`next()` allows downstream route handlers to override them if needed. If you set
headers after `next()`, your middleware has the final say and routes cannot
customize the caching behavior for specific responses.

### Migrating Previously Cached Stable URLs

Changing response headers does not invalidate a copy a browser has already
stored as fresh. A visitor who cached `/build/main.css` under an earlier
four-hour policy keeps using it until that lifetime runs out, no matter what the
origin sends now. To force the switch once, change the URL the layout links to
so the stale entry is never looked up again:

```tsx
// routes/main.tsx
<link rel="stylesheet" href="/build/main.css?v=2" precedence="default" />;
```

Any change works: a query string, a renamed entry point, or a versioned path.
The new URL is served with the revalidation policy, so you can drop the suffix
in a later release once the old lifetime has expired.

CDNs can override origin headers. Cloudflare's
[Browser Cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/set-browser-ttl/)
setting, for example, can replace `Cache-Control` before the response reaches
the browser. Verify the headers on the public custom domain rather than only on
localhost or a preview hostname.

### Custom Static Asset Caching

Static files in the `public/` directory outside of `/build/` (such as images,
fonts, and other assets) do not have cache headers set automatically. Add
middleware in your route handlers to control caching for these files:

```typescript
// routes/main.ts
import { Hono } from "hono";

const app = new Hono();

// Cache images for 1 day
app.use("/images/*", async (c, next) => {
  c.header("Cache-Control", "public, max-age=86400");
  await next();
});

export default app;
```

**Cache strategies:**

| Asset Type                          | Cache-Control                               | Reason                          |
| ----------------------------------- | ------------------------------------------- | ------------------------------- |
| `main.js` (framework)               | `private, no-cache, must-revalidate` + ETag | No hash, needs revalidation     |
| CSS and other stable entry points   | `private, no-cache, must-revalidate` + ETag | No hash, needs revalidation     |
| Fingerprinted output (`*-XXXXXXXX`) | `public, max-age=14400`                     | Content hash in filename        |
| Images/fonts                        | `max-age=86400`                             | May change, cache for 1 day     |
| HTML                                | `no-cache`                                  | Always fetch latest             |
| API responses                       | Varies                                      | Depends on data freshness needs |

## Next Steps

**Next:** [Metadata](metadata.md) - Page titles and meta tags

**Related topics:**

- [Styling](styling.md) - CSS and TailwindCSS integration
- [Configuration](configuration.md) - Project and build configuration
- [Deployment](deployment.md) - Deploy to Deno Deploy, Docker, and more
