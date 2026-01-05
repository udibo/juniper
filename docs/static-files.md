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

These files are automatically included in the HTML during SSR. You don't need to
manually reference them.

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

Juniper automatically applies cache headers to build artifacts in `/build/`:

| File             | Cache-Control                                   | Reason                                             |
| ---------------- | ----------------------------------------------- | -------------------------------------------------- |
| `/build/main.js` | `private, no-cache, must-revalidate, max-age=0` | Main entry point changes on each build, uses ETag  |
| Other `/build/*` | `public, max-age=14400` (4 hours)               | Chunk files have content hashes in their filenames |

The `main.js` bundle uses `no-cache` with ETag validation because:

- It doesn't have a content hash in its filename
- CDNs and proxies should not cache it (hence `private`)
- Browsers can still use their cache if the ETag matches, avoiding re-downloads
  when unchanged

Other build files like `chunk-[hash].js` can be cached longer because the hash
in the filename changes when content changes.

### Overriding Default Cache Headers

The framework sets cache headers _before_ your route handlers run, so you can
override them with your own middleware. For example, to extend caching for
chunked build files (which have content hashes in their filenames):

```typescript
// routes/main.ts
import { Hono } from "hono";

const app = new Hono();

// Extend caching for chunked files (skip main.js which needs revalidation)
app.use("/build/*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname !== "/build/main.js") {
    c.header("Cache-Control", "public, max-age=31536000");
  }
  await next();
});

export default app;
```

**Why set headers before `next()`?** Setting cache headers before calling
`next()` allows downstream route handlers to override them if needed. If you set
headers after `next()`, your middleware has the final say and routes cannot
customize the caching behavior for specific responses.

### Adding ETag Validation for CSS Entry Points

If you have a CSS entry point (like `main.css` from TailwindCSS or Sass), you
may want to apply the same caching strategy as `main.js` - preventing CDN
caching while allowing efficient browser cache validation with ETags:

```typescript
// routes/main.ts
import { Hono } from "hono";
import { etag } from "hono/etag";

const app = new Hono();

// Apply no-cache with ETag for main.css (same strategy as main.js)
app.use("/build/main.css", etag(), async (c, next) => {
  c.header("Cache-Control", "private, no-cache, must-revalidate, max-age=0");
  await next();
});

export default app;
```

This is useful for CSS entry points because:

- The filename doesn't include a content hash
- Users get the latest styles immediately after deployment
- ETags prevent unnecessary re-downloads when the file hasn't changed

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

| Asset Type                | Cache-Control                               | Reason                          |
| ------------------------- | ------------------------------------------- | ------------------------------- |
| `main.js` (framework)     | `private, no-cache, must-revalidate` + ETag | No hash, needs revalidation     |
| Chunked JS (`chunk-*.js`) | `public, max-age=14400`                     | Content hash in filename        |
| CSS entry points          | Consider `no-cache` + ETag (see above)      | No hash, may want revalidation  |
| Images/fonts              | `max-age=86400`                             | May change, cache for 1 day     |
| HTML                      | `no-cache`                                  | Always fetch latest             |
| API responses             | Varies                                      | Depends on data freshness needs |

## Next Steps

**Next:** [Metadata](metadata.md) - Page titles and meta tags

**Related topics:**

- [Styling](styling.md) - CSS and TailwindCSS integration
- [Configuration](configuration.md) - Project and build configuration
- [Deployment](deployment.md) - Deploy to Deno Deploy, Docker, and more
