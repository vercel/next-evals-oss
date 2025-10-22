# Server-Side Routing Eval

## What this eval tests
This evaluation tests the ability to perform navigation and routing from a server component in the Next.js App Router, which is a common misconception since server components cannot directly handle routing.

## Why it's important
LLMs often struggle with:
- Understanding that server components cannot use client-side routing hooks (`useRouter`, `usePathname`)
- Knowing that navigation must be handled through client components or server actions
- Understanding the difference between server-side redirects and client-side navigation
- Properly implementing routing patterns that work with server components
- Using `redirect()` from `next/navigation` for server-side redirects
- Creating proper client components for interactive navigation

## How it works
The test validates that:
1. Server components do not attempt to use client-side routing hooks
2. Navigation is handled through appropriate server-side or client-side patterns
3. Server actions or client components are used for interactive routing
4. The `redirect()` function is used correctly for server-side redirects
5. Proper separation between server and client routing logic

## Expected result
The implementation should use one of these patterns:

**Server-side redirect (conditional):**
```typescript
import { redirect } from 'next/navigation';

export default async function Page({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  // Server-side conditional redirect
  if (searchParams.redirect === 'dashboard') {
    redirect('/dashboard');
  }
  
  return (
    <div>
      <h1>Page Content</h1>
    </div>
  );
}
```

**Client component for interactive navigation:**
```typescript
'use client';

import { useRouter } from 'next/navigation';

export default function NavigationButton() {
  const router = useRouter();
  
  const handleNavigation = () => {
    router.push('/new-page');
  };
  
  return (
    <button onClick={handleNavigation}>
      Navigate to New Page
    </button>
  );
}
```

**Server action for form-based navigation:**
```typescript
async function navigateAction() {
  'use server';
  redirect('/destination');
}

export default function Page() {
  return (
    <form action={navigateAction}>
      <button type="submit">Navigate</button>
    </form>
  );
}
```

## Success criteria
- No use of client-side routing hooks in server components
- Proper use of `redirect()` for server-side redirects when appropriate
- Client components used for interactive navigation requiring user interaction
- Server actions used for form-based navigation
- Clear separation between server and client routing responsibilities