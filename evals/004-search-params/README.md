# Server Component Search Parameters

## What This Eval Tests

This evaluation tests the ability to handle URL search parameters in Next.js 15 App Router server components and pass data to client components. This tests the understanding of Next.js v15's async searchParams API.

## Why This Is Important

**Common LLM Mistakes:**
- **Synchronous searchParams**: Not handling the Promise-based API in Next.js v15
- **Missing async/await**: Not properly awaiting searchParams resolution
- **Type safety issues**: Incorrect TypeScript types for searchParams
- **Client component confusion**: Trying to access searchParams directly in client components

**Real-world Impact:**
Search parameters are fundamental for building filterable lists, pagination, search functionality, and shareable URLs. Next.js v15 changed searchParams to be async, which many developers miss.

## How The Test Works

**What Gets Tested:**
- ✅ Component is async server component (no 'use client')
- ✅ Properly awaits searchParams (Next.js v15 API)
- ✅ Extracts 'name' parameter correctly
- ✅ Passes data to Client component as prop
- ✅ Has proper TypeScript types

## Expected Result

```tsx
import Client from './Client';

interface PageProps {
  searchParams: Promise<{ name?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const name = params.name;

  return <Client name={name} />;
}
```

**Success Criteria:**
- Server component properly handles async searchParams
- URL parameter is extracted and passed to client component
- TypeScript types are correct
- Component works with Next.js v15 API changes