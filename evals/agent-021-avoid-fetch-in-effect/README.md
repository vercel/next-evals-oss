# Avoid Fetch in useEffect Eval

## What this eval tests
This evaluation tests the ability to implement data fetching using Next.js App Router patterns instead of client-side `useEffect` and `fetch` combinations.

## Why it's important
LLMs often struggle with:
- Preferring server-side data fetching over client-side `useEffect` patterns
- Understanding when to use server components vs client components for data fetching
- Avoiding the `useEffect` + `fetch` + `useState` pattern common in client-only React
- Implementing proper loading and error handling with server components
- Understanding the benefits of server-side rendering for SEO and performance

## How it works
The test validates that:
1. Data fetching is performed server-side in server components
2. No `useEffect` hook is used for initial data loading
3. Component follows existing codebase patterns for data fetching
4. Proper async/await patterns are used in server components
5. Component handles loading and error states appropriately

## Expected result
The implementation should use server-side data fetching:

```typescript
// Server component - no 'use client' directive
async function getUserProfile() {
  const res = await fetch('/api/users/profile');
  if (!res.ok) {
    throw new Error('Failed to fetch user profile');
  }
  return res.json();
}

export default async function UserProfile() {
  const user = await getUserProfile();

  return (
    <div>
      <h1>User Profile</h1>
      <div>
        <p><strong>Name:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
      </div>
    </div>
  );
}
```

**Instead of the problematic client-side pattern:**
```typescript
// Avoid this pattern
'use client';

import { useState, useEffect } from 'react';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users/profile')
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>User Profile</h1>
      <p>Name: {user?.name}</p>
      <p>Email: {user?.email}</p>
    </div>
  );
}
```

## Success criteria
- Component is a server component (no `'use client'` directive)
- Data fetching performed server-side with async/await
- No `useEffect`, `useState`, or client-side fetch patterns
- Follows existing codebase patterns for data fetching
- Proper error handling and data rendering