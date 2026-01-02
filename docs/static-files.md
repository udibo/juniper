# Static Files

## Public Directory

The `public` directory serves static files directly to clients. Place assets like images, fonts, and favicons here:

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

Juniper automatically serves files from the `public` directory. The built-in static file handler:

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

These files are automatically included in the HTML during SSR. You don't need to manually reference them.

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
/>
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

Configure caching for static assets using Hono middleware:

```typescript
// routes/main.ts
import { Hono } from "hono";

const app = new Hono();

// Cache build assets for 1 year (they have hashed filenames)
app.use("/build/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "public, max-age=31536000, immutable");
});

// Cache other static assets for 1 day
app.use("/images/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "public, max-age=86400");
});

// Don't cache HTML
app.use("*", async (c, next) => {
  await next();
  if (c.res.headers.get("Content-Type")?.includes("text/html")) {
    c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  }
});

export default app;
```

**Cache strategies:**

| Asset Type | Cache-Control | Reason |
|-----------|---------------|--------|
| Build output (`/build/*`) | `max-age=31536000, immutable` | Filenames include content hash |
| Images/fonts | `max-age=86400` | May change, cache for 1 day |
| HTML | `no-cache` | Always fetch latest |
| API responses | Varies | Depends on data freshness needs |

## Next Steps

**Next:** [Metadata](metadata.md) - Page titles and meta tags

**Related topics:**

- [Styling](styling.md) - CSS and TailwindCSS integration
- [Configuration](configuration.md) - Project and build configuration
- [Deployment](deployment.md) - Deploy to Deno Deploy, Docker, and more
