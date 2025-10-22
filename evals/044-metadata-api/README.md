# Metadata API

## What This Eval Tests

This evaluation tests the ability to use Next.js Metadata API for SEO optimization using the metadata export in App Router.

## Why This Is Important

**Common LLM Mistakes:**
- **Wrong export name**: Using meta or seo instead of metadata
- **Client component**: Adding metadata to client components
- **Wrong structure**: Incorrect metadata object structure
- **Missing types**: Not using proper TypeScript types
- **Dynamic metadata confusion**: Mixing static and dynamic approaches

**Real-world Impact:**
Metadata API enables:
- Better SEO with proper meta tags
- Social media preview cards
- Search engine optimization
- Consistent metadata management
- Type-safe metadata configuration

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Exports metadata object
- ✅ Has correct title and description
- ✅ Includes openGraph configuration
- ✅ Server component (no 'use client')
- ✅ Renders page content

## Expected Result

```tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My App',
  description: 'Welcome to my application',
  openGraph: {
    title: 'My App OG',
    description: 'OG Description',
  },
};

export default function Page() {
  return <h1>Metadata Example</h1>;
}
```

**Key Patterns Validated:**
- **Named Export**: Uses export const metadata
- **Type Safety**: Proper Metadata type
- **OpenGraph**: Includes social media metadata
- **Server Component**: No client directive

**Success Criteria:**
- Metadata object exported correctly
- All required fields present
- OpenGraph configuration included
- Page renders with h1 content