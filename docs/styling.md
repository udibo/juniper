# Styling

Juniper does not prescribe a single styling strategy. Because the builder relies
on esbuild, you can mix global CSS files, utility frameworks, CSS-in-JS, or
inline styles. This guide summarizes the most common approaches and how they
interact with streaming HTML.

## Global CSS

Place static styles directly inside `public/` and reference them from the root
layout:

```tsx
// routes/main.tsx
export default function Main() {
  return (
    <>
      <link rel="stylesheet" href="/styles/global.css" />
      <Outlet />
    </>
  );
}
```

Pros:

- No build step is required for the stylesheet.
- Cached aggressively by CDNs (just version the filename when it changes).

Cons:

- The file is not fingerprinted automatically, so you must manage cache
  invalidation manually.

## Bundled CSS entry points

When you want hashed filenames and tree shaking, add CSS files to the builder’s
`entryPoints`:

```ts
export const builder = new Builder({
  projectRoot,
  entryPoints: ["./styles/global.css", "./styles/admin.css"],
});
```

`deno task build` produces `/build/global.css` and `/build/admin.css`. Reference
them via `<link>` tags in the appropriate layouts or routes.

## CSS imports inside components

Because esbuild understands CSS imports, you can co-locate styles:

```tsx
import "./post.css";

export default function PostCard() {
  return <article className="post-card">...</article>;
}
```

The CSS is bundled into the nearest entry point (`/build/main.js`) and
automatically injected at runtime. This works well for CSS modules, Tailwind’s
`@apply`, or other component-scoped techniques.

## Utility frameworks (Tailwind, PostCSS)

- Install the required tooling in your repo (e.g., `tailwind.config.ts`,
  `postcss.config.js`).
- Generate a compiled CSS file (e.g., `styles/tailwind.css`) and add it as an
  entry point or import it globally.
- If you need custom transforms, push additional esbuild plugins onto
  `builder.plugins`. For instance, `_build.ts` already integrates React
  Compiler; you can append PostCSS/Tailwind plugins in `build.ts`.

## Inline styles and CSS-in-JS

React 19 works seamlessly with inline styles or libraries such as
Emotion/Stitches. Because hydration uses the same component tree, any
client-side styling solution that does not rely on Node-specific primitives will
work. Remember to avoid using `window` during SSR unless you guard it with
`isBrowser()`.

## Critical CSS considerations

- Inline the bare minimum of CSS in the root layout if you need above-the-fold
  rendering before bundles load.
- For the rest of the styles, use `<link rel="preload" as="style">` or
  `rel="stylesheet"` tags to defer loading.
- When streaming, React updates `<title>`/`<meta>` inline but does not flush
  `<style>` tags until their components render. Keep critical CSS near the top
  of your component tree to avoid flashes of unstyled content.

## Troubleshooting

| Issue                    | Fix                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| CSS not updating in dev  | Ensure the file resides in `public/` or is referenced by a watched entry point; otherwise add the directory to `watchPaths`. |
| MIME type incorrect      | Keep `.css` extensions; esbuild determines MIME types from filenames.                                                        |
| Tailwind classes missing | Confirm the file path is included in `tailwind.config.ts` `content` globs and rebuild.                                       |

## Next steps

- Continue with [Metadata](metadata.md) to wire CSS files into your document
  head.
- Jump to [Forms](forms.md) or [State Management](state-management.md) to see
  styling applied inside interactive routes.
