# Metadata

## React 19 Document Metadata

React 19 supports rendering `<title>`, `<meta>`, and `<link>` tags directly in
components. These tags are automatically hoisted to the document `<head>` during
rendering. Metadata with `itemProp` describes an item rather than the whole
document and is not hoisted. Stylesheet links need `precedence` for React's
special resource handling; see [styling](styling.md#linking-stylesheets).

The route examples below use this loader data shape. In an application, export
it from the matching route module and reuse it with a type-only import:

```tsx
import type { AnyParams, RouteProps } from "@udibo/juniper";

interface LoaderData {
  post: {
    title: string;
    excerpt: string;
    content: string;
    slug: string;
    tags: string[];
    coverImage: string;
    publishedAt: string;
    updatedAt: string;
    author: { name: string };
  };
}

export default function BlogPost(
  { loaderData }: RouteProps<AnyParams, LoaderData>,
): React.JSX.Element {
  return (
    <>
      <title>{`${loaderData.post.title} | My Blog`}</title>
      <meta name="description" content={loaderData.post.excerpt} />

      <article>
        <h1>{loaderData.post.title}</h1>
        <p>{loaderData.post.content}</p>
      </article>
    </>
  );
}
```

The snippets below are alternative renderings using those same types.

## Setting Page Titles

Set the page title using the `<title>` element:

```tsx
export default function About() {
  return (
    <>
      <title>About Us | My App</title>
      <h1>About Us</h1>
    </>
  );
}
```

For a dynamic title, use the route's typed loader data:

```tsx
export default function BlogPost(
  { loaderData }: RouteProps<AnyParams, LoaderData>,
) {
  return (
    <>
      <title>{loaderData.post.title}</title>
      <article>{loaderData.post.content}</article>
    </>
  );
}
```

A reusable component can supply a fallback when a name is absent:

```tsx
export function ProductTitle({ name }: { name?: string }): React.JSX.Element {
  const title = name || "Product";
  return (
    <>
      <title>{`${title} | Store`}</title>
    </>
  );
}
```

## Meta Tags

Add meta tags for SEO and social sharing:

```tsx
export default function BlogPost(
  { loaderData }: RouteProps<AnyParams, LoaderData>,
) {
  const { post } = loaderData;

  return (
    <>
      <title>{post.title}</title>
      <meta name="description" content={post.excerpt} />
      <meta name="keywords" content={post.tags.join(", ")} />

      <meta name="robots" content="index, follow" />

      <link rel="canonical" href={`https://example.com/blog/${post.slug}`} />

      <article>{loaderData.post.content}</article>
    </>
  );
}
```

Common meta tags:

```tsx
// Prevent indexing (for private pages)
<meta name="robots" content="noindex, nofollow" />

// Viewport (usually in root layout)
<meta name="viewport" content="width=device-width, initial-scale=1" />

// Character encoding
<meta charSet="utf-8" />

// Author
<meta name="author" content="Your Name" />

// Theme color (for mobile browsers)
<meta name="theme-color" content="#10b981" />
```

## Open Graph Tags

Add Open Graph tags for rich social media previews:

```tsx
export default function BlogPost(
  { loaderData }: RouteProps<AnyParams, LoaderData>,
) {
  const { post } = loaderData;
  const url = `https://example.com/blog/${post.slug}`;

  return (
    <>
      <title>{post.title}</title>
      <meta name="description" content={post.excerpt} />

      <meta property="og:type" content="article" />
      <meta property="og:title" content={post.title} />
      <meta property="og:description" content={post.excerpt} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={post.coverImage} />
      <meta property="og:site_name" content="My Blog" />

      <meta property="article:published_time" content={post.publishedAt} />
      <meta property="article:author" content={post.author.name} />
      {post.tags.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={post.title} />
      <meta name="twitter:description" content={post.excerpt} />
      <meta name="twitter:image" content={post.coverImage} />

      <article>{loaderData.post.content}</article>
    </>
  );
}
```

## Structured Data

Add JSON-LD structured data for rich search results:

```tsx
export default function BlogPost(
  { loaderData }: RouteProps<AnyParams, LoaderData>,
) {
  const { post } = loaderData;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: {
      "@type": "Person",
      name: post.author.name,
    },
  };

  return (
    <>
      <title>{post.title}</title>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <article>{loaderData.post.content}</article>
    </>
  );
}
```

Escape `<` in JSON embedded through `dangerouslySetInnerHTML` so a value such as
`</script>` cannot close the script element in the served HTML. JSON-LD's
non-executable MIME type does not change HTML parsing. React escapes ordinary
text children, but it does not escape `dangerouslySetInnerHTML` for you.

Common structured data types:

```tsx
// Organization
const orgData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "My Company",
  url: "https://example.com",
  logo: "https://example.com/logo.png",
};

// Product
const productData = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: product.name,
  image: product.images,
  description: product.description,
  offers: {
    "@type": "Offer",
    price: product.price,
    priceCurrency: "USD",
  },
};

// Breadcrumb
const breadcrumbData = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "/" },
    { "@type": "ListItem", position: 2, name: "Blog", item: "/blog" },
    { "@type": "ListItem", position: 3, name: post.title },
  ],
};
```

## Per-Route Metadata

Give each document one owner for its title and description. Keep shared tags
such as the viewport and favicon in the root layout; put page-specific tags in
the leaf page and its error boundary.

```tsx
// routes/main.tsx
import { Outlet } from "react-router";

export default function Main() {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" />

      <Outlet />
    </>
  );
}
```

```tsx
// routes/blog/index.tsx
export default function BlogList() {
  return (
    <>
      <title>Blog | My App</title>
      <meta name="description" content="Read our latest blog posts" />
    </>
  );
}
```

```tsx
// routes/blog/[id]/index.tsx
export default function BlogPost(
  { loaderData }: RouteProps<AnyParams, LoaderData>,
) {
  return (
    <>
      <title>{`${loaderData.post.title} | My App`}</title>
      <meta name="description" content={loaderData.post.excerpt} />
    </>
  );
}
```

React hoists metadata into the head; it does not implement a last-rendered-wins
override system. In particular, rendering two titles leaves both in the head.
Render a title as a **single string**, using interpolation when it contains
dynamic values. See React's
[title reference](https://react.dev/reference/react-dom/components/title).

## Next Steps

**Next:** [Database](database.md) - Deno KV and PostgreSQL

**Related topics:**

- [Routing](routing.md) - File-based routing and data loading
- [Styling](styling.md) - CSS and TailwindCSS integration
- [Static Files](static-files.md) - Serving static assets
