# Server Component Static Metadata

## What This Eval Tests

This evaluation tests the ability to implement static metadata in Next.js App Router server components using the Metadata API. This is the standard way to set page metadata in modern Next.js applications.

## Why This Is Important

**Common LLM Mistakes:**
- **Client-side metadata**: Using `next/head` or React Helmet instead of Metadata API
- **Wrong export syntax**: Using `metadata` function instead of object export
- **Incomplete metadata**: Only setting title without proper metadata structure
- **Client component confusion**: Adding 'use client' when metadata should be server-side

**Real-world Impact:**
Proper metadata is essential for SEO, social media sharing, and browser behavior. The static Metadata API is the recommended approach for setting consistent page metadata in Next.js App Router.

## How The Test Works

**What Gets Tested:**
- ✅ Component is server component (no 'use client')
- ✅ Exports static `metadata` object
- ✅ Sets title to "My" as specified
- ✅ Uses proper Next.js Metadata API structure

## Expected Result

```tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My',
};

export default function Page() {
  return (
    <div>
      <h1>My Page</h1>
    </div>
  );
}
```

**Success Criteria:**
- Static metadata object is properly exported
- Title is set to the specified value
- Server component renders correctly
- Metadata appears in page head