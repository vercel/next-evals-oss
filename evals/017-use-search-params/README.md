# useSearchParams Hook Eval

## What this eval tests
This evaluation tests the proper usage of the `useSearchParams` hook with Suspense boundaries in Next.js App Router, which is required for client-side search parameter access.

## Why it's important
LLMs often struggle with:
- Understanding that `useSearchParams` requires a Suspense boundary to prevent hydration issues
- Wrapping components properly with Suspense when using `useSearchParams`
- Using the correct import path for `useSearchParams` in App Router
- Understanding the difference between server-side `searchParams` prop and client-side `useSearchParams`
- Handling the loading state while search parameters are being resolved

## How it works
The test validates that:
1. Component uses `'use client'` directive for client-side functionality
2. `useSearchParams` is imported from `'next/navigation'`
3. Component is properly wrapped with Suspense boundary
4. Search parameters are accessed and used correctly
5. Fallback UI is provided for the Suspense boundary

## Expected result
The implementation should create a component with proper Suspense wrapping:

```typescript
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SearchParamsComponent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  const filter = searchParams.get('filter');

  return (
    <div>
      <h1>Search Results</h1>
      {query && <p>Query: {query}</p>}
      {filter && <p>Filter: {filter}</p>}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading search parameters...</div>}>
      <SearchParamsComponent />
    </Suspense>
  );
}
```

## Success criteria
- Component uses `'use client'` directive
- `useSearchParams` imported from `'next/navigation'`
- Component wrapped with Suspense boundary
- Proper fallback UI provided for loading state
- Search parameters accessed and displayed correctly