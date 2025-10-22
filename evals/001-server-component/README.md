# Server Component Data Fetching

## What This Eval Tests

This evaluation tests the ability to implement server-side data fetching using React Server Components (RSC) in Next.js App Router. This is a fundamental pattern for building performant, SEO-friendly applications.

## Why This Is Important

**Common LLM Mistakes:**
- **Client-side fetching**: Using `useEffect` and `useState` instead of server-side fetching
- **Missing async declaration**: Forgetting to make the component `async`
- **Incorrect API calls**: Not properly awaiting fetch requests or JSON parsing
- **Wrong data access**: Not correctly accessing the first item from an array
- **Client component confusion**: Adding `'use client'` when server-side fetching is needed

**Real-world Impact:**
Server Components are a core feature of modern Next.js applications. They enable:
- Better SEO (content rendered on server)
- Faster initial page loads
- Reduced client-side JavaScript bundle size
- Direct database/API access without exposing credentials to client

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Component is declared as `async function`
- ✅ No `'use client'` directive (must be server component)
- ✅ Fetches from correct API endpoint (`api.vercel.app/products`)
- ✅ Uses `await` for both fetch request and JSON parsing
- ✅ Accesses first product from array (`products[0]`)
- ✅ Renders product name in `<h1>` tag
- ✅ Handles response parsing correctly

## Expected Result

```tsx
export default async function Page() {
  const response = await fetch('https://api.vercel.app/products');
  const products = await response.json();
  
  const firstProduct = products[0];
  
  return <h1>{firstProduct.name}</h1>;
}
```

**Key Patterns Validated:**
- **Async Server Component**: Function is declared with `async`
- **Server-side Fetch**: No client-side state management hooks
- **Proper Awaiting**: Both fetch and JSON parsing are awaited
- **Array Access**: Correctly gets first item with `[0]` index
- **Simple Rendering**: Direct rendering without complex state management

**Success Criteria:**
- Component successfully fetches data server-side
- First product name is displayed in h1 tag
- No client-side JavaScript required for data fetching
- Application builds and renders correctly