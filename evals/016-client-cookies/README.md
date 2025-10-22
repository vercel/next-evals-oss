# Client Cookies Eval

## What this eval tests
This evaluation tests the ability to create a client component that properly calls a server action to set cookies, demonstrating the correct pattern for cookie management in Next.js App Router.

## Why it's important
LLMs often struggle with:
- Understanding that cookies must be set server-side, not client-side
- Creating proper client components that trigger server actions for cookie operations
- Using the `cookies()` function correctly in server actions
- Understanding the separation between client interaction and server cookie management
- Avoiding direct cookie manipulation in client components using `document.cookie`

## How it works
The test validates that:
1. A client component is created with `'use client'` directive
2. The component triggers a server action on user interaction (click)
3. The server action properly uses Next.js cookie APIs
4. No direct client-side cookie manipulation is attempted
5. Proper error handling and user feedback patterns are implemented

## Expected result
The implementation should create a client component that calls a server action:

```typescript
'use client';

import { setCookieAction } from './actions';

export default function CookieButton() {
  const handleSetCookie = async () => {
    await setCookieAction('user_preference', 'dark_mode');
  };

  return (
    <button onClick={handleSetCookie}>
      Set Cookie
    </button>
  );
}
```

With a corresponding server action:
```typescript
'use server';

import { cookies } from 'next/headers';

export async function setCookieAction(name: string, value: string) {
  const cookieStore = cookies();
  
  cookieStore.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}
```

## Success criteria
- Client component uses `'use client'` directive
- Component triggers server action on user interaction
- Server action uses `cookies()` from `next/headers`
- No direct client-side cookie manipulation
- Proper separation of client UI and server cookie operations