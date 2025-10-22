# useRouter Hook Eval

## What this eval tests
This evaluation tests the proper usage of the `useRouter` hook in Next.js App Router for client-side navigation and routing operations.

## Why it's important
LLMs often struggle with:
- Using the correct import path for `useRouter` in App Router (`'next/navigation'` vs `'next/router'`)
- Understanding that `useRouter` can only be used in client components
- Using the updated API methods (`push`, `replace`, `refresh`, etc.)
- Avoiding Pages Router patterns when working with App Router
- Understanding when to use `useRouter` vs Link component vs server-side redirects

## How it works
The test validates that:
1. Component uses `'use client'` directive
2. `useRouter` is imported from `'next/navigation'` (App Router)
3. Router methods are used correctly (e.g., `router.push()`)
4. Component handles navigation appropriately
5. No mixing of Pages Router and App Router patterns

## Expected result
The page should navigate to `/about` when a button labeled "Navigate" is clicked:

```typescript
'use client';

import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  return (
    <button onClick={() => router.push('/about')}>
      Navigate
    </button>
  );
}
```

## Success criteria
- Component uses `'use client'` directive
- `useRouter` imported from `'next/navigation'` (not `'next/router'`)
- Clicking the button calls `router.push('/about')`
- No mixing of Pages Router API patterns
- Appropriate use cases for programmatic navigation