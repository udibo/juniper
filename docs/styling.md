# Styling

## Overview

Juniper supports multiple approaches to styling your application, from
traditional CSS files to modern utility-first frameworks like TailwindCSS.

## CSS Files

### Creating CSS Files

Place CSS files directly in the `public/` directory to serve them as static
assets:

```css
/* public/main.css */
:root {
  --primary-color: #3b82f6;
  --text-color: #1f2937;
}

body {
  font-family: system-ui, sans-serif;
  color: var(--text-color);
  margin: 0;
  padding: 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}
```

Files in `public/` are served directly without any build step. This is the
simplest approach for plain CSS.

Optionally, you can add plain CSS files as build entrypoints to get minification
from esbuild:

```typescript
// build.ts
import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  entryPoints: ["./main.css"], // CSS outside public/
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

The minified output goes to `public/build/main.css`.

## CSS Imports

### Linking Stylesheets

Import CSS in your root layout using a `<link>` element with the `precedence`
attribute for proper SSR handling:

```tsx
// routes/main.tsx
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1.0" />
      <link rel="stylesheet" href="/main.css" precedence="default" />
      {children}
    </main>
  );
}

export default function Main() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
```

The `precedence` attribute tells React how to order stylesheets during SSR,
preventing flash of unstyled content (FOUC).

### Route-Specific Stylesheets

Add stylesheets for specific routes by placing them in the `public/` directory:

```tsx
// routes/dashboard.tsx
export default function Dashboard() {
  return (
    <>
      <link rel="stylesheet" href="/dashboard.css" precedence="default" />
      <div className="dashboard">
        {/* Dashboard content */}
      </div>
    </>
  );
}
```

Organize your CSS files in subdirectories within `public/` as needed:

```
public/
├── main.css
├── dashboard.css
└── components/
    ├── button.css
    └── card.css
```

## PostCSS Integration

For advanced CSS processing like TailwindCSS, CSS Modules, Sass, Less, or
Stylus, use the
[@udibo/esbuild-plugin-postcss](https://jsr.io/@udibo/esbuild-plugin-postcss)
plugin. Unlike plain CSS files that go directly in `public/`, files that need
transformation are placed outside `public/` and added as build entrypoints.

### Basic Setup

**1. Add the plugin dependency to deno.json:**

```json
{
  "imports": {
    "@udibo/esbuild-plugin-postcss": "jsr:@udibo/esbuild-plugin-postcss@^0.3"
  }
}
```

**2. Configure the build:**

```typescript
// build.ts
import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";
import { postCSSPlugin } from "@udibo/esbuild-plugin-postcss";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  plugins: [
    postCSSPlugin({
      plugins: [], // Add PostCSS plugins here
    }),
  ],
  entryPoints: ["./main.css"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

**3. Link the built stylesheet:**

```tsx
// routes/main.tsx
<link rel="stylesheet" href="/build/main.css" precedence="default" />;
```

Transformed CSS files are output to `public/build/`.

### TailwindCSS

Juniper provides a TailwindCSS template with everything pre-configured:

```bash
deno run -A npm:degit udibo/juniper/templates/tailwindcss my-app
```

Or add TailwindCSS to an existing project:

**1. Add dependencies and configuration to deno.json:**

```json
{
  "nodeModulesDir": "auto",
  "imports": {
    "tailwindcss": "npm:tailwindcss@^4",
    "@tailwindcss/postcss": "npm:@tailwindcss/postcss@^4",
    "@udibo/esbuild-plugin-postcss": "jsr:@udibo/esbuild-plugin-postcss@^0.3"
  }
}
```

> **Note:** The `nodeModulesDir: "auto"` setting is required for TailwindCSS to
> work correctly. This enables Deno to create a local `node_modules` directory
> that TailwindCSS's internal resolver needs to locate dependencies.

**2. Create your main CSS file outside `public/`:**

```css
/* main.css (in project root, NOT in public/) */
@import "tailwindcss";
```

**3. Configure the build:**

```typescript
// build.ts
import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";
import { postCSSPlugin } from "@udibo/esbuild-plugin-postcss";
import tailwindcss from "@tailwindcss/postcss";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  plugins: [
    postCSSPlugin({
      plugins: [tailwindcss()],
    }),
  ],
  entryPoints: ["./main.css"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

**4. Link the built stylesheet in your layout:**

```tsx
// routes/main.tsx
<link rel="stylesheet" href="/build/main.css" precedence="default" />;
```

**5. Customize your theme** using TailwindCSS 4's CSS-based configuration:

```css
/* main.css */
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --color-secondary: #10b981;
  --font-display: "Inter", sans-serif;
}

@utility scrollbar-hidden {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
```

### CSS Modules

CSS Modules provide scoped class names to avoid style conflicts. Enable them
with the `modules` option:

**1. Add the dependency:**

```json
{
  "imports": {
    "@udibo/esbuild-plugin-postcss": "jsr:@udibo/esbuild-plugin-postcss@^0.3"
  }
}
```

**2. Configure the build with CSS Modules:**

```typescript
// build.ts
import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";
import { postCSSPlugin } from "@udibo/esbuild-plugin-postcss";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  plugins: [
    postCSSPlugin({
      modules: true, // Enable CSS Modules
    }),
  ],
  entryPoints: ["./components/Button.module.css"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

**3. Create a CSS Module file:**

```css
/* components/Button.module.css */
.button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}

.primary {
  background-color: #3b82f6;
  color: white;
}

.secondary {
  background-color: #e5e7eb;
  color: #1f2937;
}
```

**4. Link the built stylesheet:**

The CSS output goes to `public/build/`. Link it in your layout or component:

```tsx
// routes/main.tsx or in the component that uses the styles
<link
  rel="stylesheet"
  href="/build/components/Button.module.css"
  precedence="default"
/>;
```

**5. Import and use the scoped class names:**

```tsx
// components/Button.tsx
import styles from "./Button.module.css.json" with { type: "json" };

interface ButtonProps {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}

export function Button({ variant = "primary", children }: ButtonProps) {
  return (
    <button className={`${styles.button} ${styles[variant]}`}>
      {children}
    </button>
  );
}
```

The plugin generates a JSON file with the mapping of original class names to
scoped names.

### Sass

Use Sass for variables, nesting, mixins, and other preprocessor features:

**1. Add dependencies:**

```json
{
  "imports": {
    "@udibo/esbuild-plugin-postcss": "jsr:@udibo/esbuild-plugin-postcss@^0.3",
    "@udibo/esbuild-plugin-postcss/sass": "jsr:@udibo/esbuild-plugin-postcss@^0.3/sass"
  }
}
```

**2. Configure the build:**

```typescript
// build.ts
import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";
import { postCSSPlugin } from "@udibo/esbuild-plugin-postcss";
import { sassPreprocessor } from "@udibo/esbuild-plugin-postcss/sass";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  plugins: [
    postCSSPlugin({
      preprocessors: [sassPreprocessor()],
    }),
  ],
  entryPoints: ["./main.scss"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

**3. Write Sass:**

```scss
/* main.scss */
$primary-color: #3b82f6;
$text-color: #1f2937;

body {
  font-family: system-ui, sans-serif;
  color: $text-color;

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
  }
}

@mixin button-variant($bg-color, $text-color) {
  background-color: $bg-color;
  color: $text-color;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}

.btn-primary {
  @include button-variant($primary-color, white);
}
```

**4. Link the built stylesheet:**

The output is compiled to CSS in `public/build/`:

```tsx
// routes/main.tsx
<link rel="stylesheet" href="/build/main.css" precedence="default" />;
```

### Less

Use Less for variables, nesting, and mixins:

**1. Add dependencies:**

```json
{
  "imports": {
    "@udibo/esbuild-plugin-postcss": "jsr:@udibo/esbuild-plugin-postcss@^0.3",
    "@udibo/esbuild-plugin-postcss/less": "jsr:@udibo/esbuild-plugin-postcss@^0.3/less"
  }
}
```

**2. Configure the build:**

```typescript
// build.ts
import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";
import { postCSSPlugin } from "@udibo/esbuild-plugin-postcss";
import { lessPreprocessor } from "@udibo/esbuild-plugin-postcss/less";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  plugins: [
    postCSSPlugin({
      preprocessors: [lessPreprocessor()],
    }),
  ],
  entryPoints: ["./main.less"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

**3. Link the built stylesheet:**

```tsx
// routes/main.tsx
<link rel="stylesheet" href="/build/main.css" precedence="default" />;
```

### Stylus

Use Stylus for expressive CSS:

**1. Add dependencies:**

```json
{
  "imports": {
    "@udibo/esbuild-plugin-postcss": "jsr:@udibo/esbuild-plugin-postcss@^0.3",
    "@udibo/esbuild-plugin-postcss/stylus": "jsr:@udibo/esbuild-plugin-postcss@^0.3/stylus"
  }
}
```

**2. Configure the build:**

```typescript
// build.ts
import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";
import { postCSSPlugin } from "@udibo/esbuild-plugin-postcss";
import { stylusPreprocessor } from "@udibo/esbuild-plugin-postcss/stylus";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  plugins: [
    postCSSPlugin({
      preprocessors: [stylusPreprocessor()],
    }),
  ],
  entryPoints: ["./main.styl"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

**3. Link the built stylesheet:**

```tsx
// routes/main.tsx
<link rel="stylesheet" href="/build/main.css" precedence="default" />;
```

### Combining Features

You can combine multiple features like TailwindCSS with CSS Modules:

```typescript
// build.ts
import * as path from "@std/path";
import { Builder } from "@udibo/juniper/build";
import { postCSSPlugin } from "@udibo/esbuild-plugin-postcss";
import tailwindcss from "@tailwindcss/postcss";

const projectRoot = path.dirname(path.fromFileUrl(import.meta.url));
export const builder = new Builder({
  projectRoot,
  configPath: "./deno.json",
  plugins: [
    postCSSPlugin({
      plugins: [tailwindcss()],
      modules: true,
    }),
  ],
  entryPoints: ["./main.css", "./components/Button.module.css"],
});

if (import.meta.main) {
  await builder.build();
  await builder.dispose();
}
```

Link each built stylesheet:

```tsx
// routes/main.tsx
<link rel="stylesheet" href="/build/main.css" precedence="default" />
<link rel="stylesheet" href="/build/components/Button.module.css" precedence="default" />
```

## CSS-in-JS

Juniper supports CSS-in-JS libraries that work with React 19 and SSR.

### Inline Styles

For simple cases, use React's inline style prop:

```tsx
function Button({ primary }: { primary?: boolean }) {
  const styles = {
    padding: "0.5rem 1rem",
    borderRadius: "0.375rem",
    backgroundColor: primary ? "#3b82f6" : "#e5e7eb",
    color: primary ? "#ffffff" : "#1f2937",
  };

  return <button style={styles}>Click me</button>;
}
```

### BEM Naming Convention

For plain CSS without PostCSS, use BEM (Block Element Modifier) naming to avoid
style conflicts:

```css
/* public/components/button.css */
.button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}

.button--primary {
  background-color: #3b82f6;
  color: white;
}

.button--secondary {
  background-color: #e5e7eb;
  color: #1f2937;
}
```

```tsx
// components/Button.tsx
interface ButtonProps {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}

export function Button({ variant = "primary", children }: ButtonProps) {
  return (
    <button className={`button button--${variant}`}>
      {children}
    </button>
  );
}
```

For true scoped class names, use [CSS Modules](#css-modules) with the PostCSS
plugin.

## Component Styles

### Organizing Styles

**Plain CSS approach** - place component styles in `public/`:

```
project/
├── public/
│   ├── main.css
│   └── components/
│       ├── Button.css
│       └── Card.css
├── components/
│   ├── Button.tsx
│   └── Card.tsx
└── routes/
    ├── main.tsx
    └── index.tsx
```

Link component styles in your layout or components:

```tsx
<link rel="stylesheet" href="/main.css" precedence="default" />
<link rel="stylesheet" href="/components/Button.css" precedence="default" />
```

**PostCSS approach** - use CSS imports for transformation:

```
project/
├── main.css              # Outside public/, uses @import
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   └── Button.css    # Component-specific styles
│   └── Card/
│       ├── Card.tsx
│       └── Card.css
└── public/
    └── build/            # Generated output
```

Import component styles in your main CSS file:

```css
/* main.css */
@import "tailwindcss";
@import "./components/Button/Button.css";
@import "./components/Card/Card.css";
```

These imports are resolved by PostCSS during the build step.

### Responsive Design

Use CSS media queries or Tailwind's responsive prefixes:

```tsx
// Using Tailwind responsive classes
function ResponsiveGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Grid items */}
    </div>
  );
}
```

```css
/* Using CSS media queries */
.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Dark Mode

Implement dark mode using CSS custom properties:

```css
/* main.css */
:root {
  --bg-color: #ffffff;
  --text-color: #1f2937;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #1f2937;
    --text-color: #f9fafb;
  }
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
}
```

With TailwindCSS, use the `dark:` variant:

```tsx
function Card() {
  return (
    <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded-lg">
      Content adapts to dark mode
    </div>
  );
}
```

### Preventing Flash of Unstyled Content

To prevent FOUC during SSR:

1. Always use the `precedence` attribute on `<link>` elements
2. Place critical styles in your main CSS file
3. Avoid dynamic style imports that depend on JavaScript

```tsx
// Plain CSS in public/
<link rel="stylesheet" href="/main.css" precedence="default" />

// Transformed CSS (TailwindCSS) in public/build/
<link rel="stylesheet" href="/build/main.css" precedence="default" />

// For critical above-the-fold styles, use a high precedence
<link rel="stylesheet" href="/critical.css" precedence="high" />
```

## Next Steps

**Next:** [Static Files](static-files.md) - Serving static assets

**Related topics:**

- [Configuration](configuration.md) - Project and build configuration
- [Metadata](metadata.md) - Page titles and meta tags
