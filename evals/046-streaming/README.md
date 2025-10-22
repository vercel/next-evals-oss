# Streaming

## What This Eval Tests

This evaluation tests the ability to implement streaming with React Suspense in Next.js App Router for progressive rendering of UI components.

## Why This Is Important

**Common LLM Mistakes:**
- **Missing Suspense import**: Forgetting to import from React
- **No async component**: Making suspended component synchronous
- **Wrong fallback syntax**: Using incorrect fallback prop
- **Client component**: Making streaming components client-side
- **No delay simulation**: Not demonstrating streaming behavior

**Real-world Impact:**
Streaming enables:
- Faster Time to First Byte (TTFB)
- Progressive page rendering
- Better perceived performance
- Non-blocking UI updates
- Improved Core Web Vitals

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Imports Suspense from React
- ✅ Fast-loading header renders immediately
- ✅ Slow component wrapped in Suspense
- ✅ Correct fallback UI
- ✅ Async component with delay
- ✅ Final content after loading

## Expected Result

```tsx
import { Suspense } from 'react';

async function SlowComponent() {
  await new Promise(resolve => setTimeout(resolve, 3000));
  return <div>Data loaded!</div>;
}

export default function Page() {
  return (
    <>
      <h1>Dashboard</h1>
      <Suspense fallback="Loading data...">
        <SlowComponent />
      </Suspense>
    </>
  );
}
```

**Key Patterns Validated:**
- **Suspense Import**: From React package
- **Async Component**: Uses async/await
- **Fallback UI**: String or component fallback
- **Progressive Rendering**: Header loads first
- **Streaming Pattern**: Proper Suspense usage

**Success Criteria:**
- Suspense imported and used correctly
- Fast content renders immediately
- Slow component has delay
- Fallback shown during loading
- Server components only