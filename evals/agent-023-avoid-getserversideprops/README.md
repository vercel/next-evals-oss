# Avoid getServerSideProps Eval

## What this eval tests
This evaluation tests the ability to implement server-side data fetching using Next.js App Router patterns instead of the Pages Router `getServerSideProps` function.

## Why it's important
LLMs often struggle with:
- Transitioning from Pages Router (`getServerSideProps`) to App Router patterns
- Understanding that App Router uses async server components instead of data fetching functions
- Implementing request-time data fetching in server components
- Avoiding Pages Router patterns when working with App Router
- Understanding the benefits of server components for dynamic data

## How it works
The test validates that:
1. Component is an async server component
2. Data fetching is performed directly in the component
3. No `getServerSideProps` or other Pages Router patterns are used
4. Dynamic, request-specific data is fetched properly
5. Component follows App Router conventions for server-side data fetching

## Expected result
The implementation should use App Router server component patterns:

```typescript
// App Router pattern - async server component
async function getUserPreferences() {
  const res = await fetch('/api/user/preferences', {
    // Ensure fresh data on each request
    cache: 'no-store',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch user preferences');
  }
  
  return res.json();
}

export default async function UserDashboard() {
  const preferences = await getUserPreferences();

  return (
    <div>
      <h1>User Dashboard</h1>
      <div>
        <h2>Your Preferences</h2>
        <p>Theme: {preferences.theme}</p>
        <p>Language: {preferences.language}</p>
        <p>Notifications: {preferences.notifications ? 'Enabled' : 'Disabled'}</p>
      </div>
    </div>
  );
}
```

**Instead of the Pages Router pattern:**
```typescript
// Avoid this pattern in App Router
export async function getServerSideProps() {
  const res = await fetch('/api/user/preferences');
  const preferences = await res.json();

  return {
    props: {
      preferences,
    },
  };
}

export default function UserDashboard({ preferences }) {
  return (
    <div>
      <h1>User Dashboard</h1>
      <p>Theme: {preferences.theme}</p>
    </div>
  );
}
```

## Success criteria
- Component is an async server component (no `'use client'`)
- Data fetching performed directly in component body
- No `getServerSideProps` or other Pages Router patterns
- Proper cache configuration for dynamic data (`cache: 'no-store'`)
- Follows App Router conventions for server-side data fetching