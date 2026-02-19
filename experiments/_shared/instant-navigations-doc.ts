/**
 * Instant Navigations documentation for agents-md experiments.
 *
 * Written to node_modules/next/dist/docs/01-app/01-getting-started/19-instant-navigations.mdx
 * so agents can discover it alongside other Next.js docs.
 */

export const INSTANT_NAVIGATIONS_DOC_PATH =
  'node_modules/next/dist/docs/01-app/01-getting-started/19-instant-navigations.mdx';

export const INSTANT_NAVIGATIONS_DOC = `---
title: Instant Navigations
description: Make client-side navigations instant using unstable_instant, Cache Components, and Suspense.
---

# Instant Navigations

## How to make navigations instant

### Step 1: Add \`unstable_instant\` to your page

\`\`\`tsx
// app/products/page.tsx
export const unstable_instant = { prefetch: 'static' }
\`\`\`

This is required. Suspense boundaries alone only cover initial page loads — client-side navigations bypass root-level Suspense and can still stall. \`unstable_instant\` enables and validates instant client-side navigations.

### Step 2: Run \`next build\`

The build will fail if any component accesses uncached data outside a \`<Suspense>\` boundary. The error message identifies exactly which component needs fixing.

### Step 3: Fix each validation error

For each component the build flags:

- **Cache it** with \`"use cache"\` — makes it part of the instant shell (appears immediately).
- **Wrap it in \`<Suspense>\`** — lets it stream in behind a loading state.

### Complete example

\`\`\`tsx
import { Suspense } from 'react'
import { cookies } from 'next/headers'

// Step 1: Required — enables instant client-side navigations
export const unstable_instant = { prefetch: 'static' }

export default function ProductsPage() {
  return (
    <main>
      <h1>Product Catalog</h1>
      {/* Step 3a: Cached — appears in the instant shell */}
      <CachedProductList />
      {/* Step 3b: Wrapped in Suspense — streams in after navigation */}
      <Suspense fallback={<p>Loading user...</p>}>
        <UserGreeting />
      </Suspense>
    </main>
  )
}

async function CachedProductList() {
  "use cache"
  const products = await getProducts()
  return (
    <ul>
      {products.map(p => (
        <li key={p.id}>{p.name} - \${p.price}</li>
      ))}
    </ul>
  )
}

async function UserGreeting() {
  const cookieStore = await cookies()
  const username = cookieStore.get('username')?.value ?? 'Guest'
  return <p>Welcome, {username}</p>
}
\`\`\`

## Config options

### \`prefetch: 'static'\`

Enables validation only. No runtime behavior change.

\`\`\`tsx
export const unstable_instant = { prefetch: 'static' }
\`\`\`

### \`prefetch: 'runtime'\`

Enables validation AND runtime prefetching:

\`\`\`tsx
export const unstable_instant = {
  prefetch: 'runtime',
  samples: [
    {
      params: { id: '123' },
      cookies: [{ name: 'session', value: 'abc123' }],
    },
  ],
}
\`\`\`

### \`unstable_instant = false\`

Exempts a segment from validation:

\`\`\`tsx
export const unstable_instant = false
\`\`\`

## Key rules

- You MUST export \`unstable_instant\` to enable instant client-side navigations.
- Components with \`"use cache"\` are cached and part of the instant shell.
- Components that call \`cookies()\`, \`headers()\`, \`connection()\`, or access dynamic data without \`"use cache"\` must be wrapped in \`<Suspense>\`.
- Request-time functions (\`cookies()\`, \`headers()\`, \`connection()\`) must NOT be called inside a \`"use cache"\` scope. Remove them or move them outside the cached function.
- The \`cacheComponents: true\` config in \`next.config.ts\` must be enabled.
`;
