# Prefer Next.js Link Eval

## What this eval tests
This evaluation tests the ability to use Next.js `Link` component for navigation instead of regular anchor tags or other navigation methods.

## Why it's important
LLMs often struggle with:
- Using regular `<a>` tags instead of Next.js `Link` component for internal navigation
- Understanding the performance benefits of Next.js Link (prefetching, client-side navigation)
- Properly importing and using the Link component from `next/link`
- Following existing navigation patterns in Next.js applications
- Understanding when to use Link vs regular anchor tags (internal vs external links)

## How it works
The test validates that:
1. Navigation uses Next.js `Link` component from `next/link`
2. Internal application routes use Link instead of anchor tags
3. Proper href attributes are provided to Link components
4. Navigation follows existing codebase patterns
5. No client-side routing hooks used for simple navigation

## Expected result
The implementation should use Next.js Link for navigation:

```typescript
import Link from 'next/link';

export default function Navigation() {
  return (
    <nav>
      <h1>Site Navigation</h1>
      <ul>
        <li>
          <Link href="/blog">
            Blog
          </Link>
        </li>
        <li>
          <Link href="/products">
            Products
          </Link>
        </li>
        <li>
          <Link href="/support">
            Support
          </Link>
        </li>
      </ul>
    </nav>
  );
}
```

**Instead of using regular anchor tags:**
```typescript
// Avoid this pattern for internal navigation
export default function Navigation() {
  return (
    <nav>
      <ul>
        <li>
          <a href="/blog">Blog</a>
        </li>
        <li>
          <a href="/products">Products</a>
        </li>
        <li>
          <a href="/support">Support</a>
        </li>
      </ul>
    </nav>
  );
}
```

**Or programmatic navigation where Link is better:**
```typescript
// Avoid this pattern for simple navigation
'use client';

import { useRouter } from 'next/navigation';

export default function Navigation() {
  const router = useRouter();

  return (
    <nav>
      <button onClick={() => router.push('/blog')}>
        Blog
      </button>
      <button onClick={() => router.push('/products')}>
        Products
      </button>
      <button onClick={() => router.push('/support')}>
        Support
      </button>
    </nav>
  );
}
```

## Success criteria
- Uses Next.js `Link` component from `next/link`
- Internal routes navigate with Link instead of anchor tags
- Proper href attributes provided to Link components
- No unnecessary programmatic navigation for simple links
- Follows existing codebase patterns for navigation