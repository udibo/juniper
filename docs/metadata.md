# Metadata

## React 19 Document Metadata

React 19 supports rendering `<title>`, `<meta>`, and `<link>` tags directly in components. These tags are automatically hoisted to the document `<head>` during rendering.

```tsx
export default function BlogPost({ loaderData }: RouteProps) {
  return (
    <>
      <title>{loaderData.post.title} | My Blog</title>
      <meta name="description" content={loaderData.post.excerpt} />

      <article>
        <h1>{loaderData.post.title}</h1>
        <p>{loaderData.post.content}</p>
      </article>
    </>
  );
}
```

This eliminates the need for third-party helmet libraries.

## Setting Page Titles

Set the page title using the `<title>` element:

```tsx
// Static title
export default function About() {
  return (
    <>
      <title>About Us | My App</title>
      <h1>About Us</h1>
    </>
  );
}

// Dynamic title from loader data
export default function BlogPost({ loaderData }: RouteProps) {
  return (
    <>
      <title>{loaderData.post.title}</title>
      <article>{/* content */}</article>
    </>
  );
}

// Title with fallback
export default function Product({ loaderData }: RouteProps) {
  const title = loaderData.product?.name || "Product";
  return (
    <>
      <title>{title} | Store</title>
      {/* content */}
    </>
  );
}
```

## Meta Tags

Add meta tags for SEO and social sharing:

```tsx
export default function BlogPost({ loaderData }: RouteProps) {
  const { post } = loaderData;

  return (
    <>
      {/* Basic SEO */}
      <title>{post.title}</title>
      <meta name="description" content={post.excerpt} />
      <meta name="keywords" content={post.tags.join(", ")} />

      {/* Robots */}
      <meta name="robots" content="index, follow" />

      {/* Canonical URL */}
      <link rel="canonical" href={`https://example.com/blog/${post.slug}`} />

      <article>{/* content */}</article>
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
export default function BlogPost({ loaderData }: RouteProps) {
  const { post } = loaderData;
  const url = `https://example.com/blog/${post.slug}`;

  return (
    <>
      <title>{post.title}</title>
      <meta name="description" content={post.excerpt} />

      {/* Open Graph */}
      <meta property="og:type" content="article" />
      <meta property="og:title" content={post.title} />
      <meta property="og:description" content={post.excerpt} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={post.coverImage} />
      <meta property="og:site_name" content="My Blog" />

      {/* Article-specific */}
      <meta property="article:published_time" content={post.publishedAt} />
      <meta property="article:author" content={post.author.name} />
      {post.tags.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={post.title} />
      <meta name="twitter:description" content={post.excerpt} />
      <meta name="twitter:image" content={post.coverImage} />

      <article>{/* content */}</article>
    </>
  );
}
```

## Structured Data

Add JSON-LD structured data for rich search results:

```tsx
export default function BlogPost({ loaderData }: RouteProps) {
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <article>{/* content */}</article>
    </>
  );
}
```

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

Set default metadata in your root layout and override in child routes:

```tsx
// routes/main.tsx - Default metadata
export default function Main() {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content="My awesome application" />
      <link rel="icon" href="/favicon.ico" />
      <title>My App</title>

      <Outlet />
    </>
  );
}
```

```tsx
// routes/blog/index.tsx - Override for blog section
export default function BlogList() {
  return (
    <>
      <title>Blog | My App</title>
      <meta name="description" content="Read our latest blog posts" />

      {/* Blog list content */}
    </>
  );
}
```

```tsx
// routes/blog/[id]/index.tsx - Dynamic metadata
export default function BlogPost({ loaderData }: RouteProps) {
  return (
    <>
      <title>{loaderData.post.title} | My App</title>
      <meta name="description" content={loaderData.post.excerpt} />

      {/* Post content */}
    </>
  );
}
```

React 19 automatically handles duplicate tags - the last rendered value wins, allowing child routes to override parent metadata.

## Next Steps

**Next:** [Database](database.md) - Deno KV and other databases

**Related topics:**

- [Routing](routing.md) - File-based routing and data loading
- [Styling](styling.md) - CSS and TailwindCSS integration
- [Static Files](static-files.md) - Serving static assets
