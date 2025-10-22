# Loading UI

## What This Eval Tests

This evaluation tests the ability to implement loading UI in Next.js App Router using the loading.tsx file convention for instant loading states.

## Why This Is Important

**Common LLM Mistakes:**
- **Wrong file name**: Using loader.tsx or other names instead of loading.tsx
- **Client component**: Making loading.tsx a client component unnecessarily
- **No async in page**: Forgetting to make page component async
- **Missing Suspense understanding**: Not grasping automatic Suspense boundaries
- **Wrong placement**: Putting loading.tsx in wrong directory

**Real-world Impact:**
Loading UI provides:
- Instant feedback during navigation
- Better perceived performance
- Automatic Suspense boundaries
- Improved user experience during data fetching

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Creates loading.tsx file
- ✅ Loading component shows correct content
- ✅ Page component is async
- ✅ Page simulates delay
- ✅ Correct className on loading spinner
- ✅ Final content displays after load

## Expected Result

**app/loading.tsx:**
```tsx
export default function Loading() {
  return <div className="loading-spinner">Loading...</div>;
}
```

**app/page.tsx:**
```tsx
export default async function Page() {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return <h1>Content Loaded</h1>;
}
```

**Key Patterns Validated:**
- **File Convention**: Uses loading.tsx filename
- **Async Server Component**: Page uses async/await
- **Loading State**: Shows while page loads
- **Simulated Delay**: Demonstrates loading behavior

**Success Criteria:**
- loading.tsx file exists and exports component
- Loading shows spinner with correct class
- Page is async and simulates delay
- Content displays after loading