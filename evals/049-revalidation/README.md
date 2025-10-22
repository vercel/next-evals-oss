# Revalidation

## What This Eval Tests

This evaluation tests the ability to implement data revalidation in Next.js App Router using both time-based and on-demand cache invalidation.

## Why This Is Important

**Common LLM Mistakes:**
- **Wrong revalidate syntax**: Incorrect fetch options structure
- **Missing revalidateTag import**: From next/cache
- **Client component**: Using server features in client
- **No cache tags**: Forgetting to tag cached data
- **Wrong action placement**: Server actions in wrong context

**Real-world Impact:**
Revalidation enables:
- Efficient data caching strategies
- On-demand cache invalidation
- Performance optimization
- Fresh data when needed
- Reduced API calls

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Async server component
- ✅ Fetch with revalidate option
- ✅ Time-based cache (60 seconds)
- ✅ Server action with revalidateTag
- ✅ Proper cache tag usage
- ✅ First product display

## Expected Result

```tsx
import { revalidateTag } from 'next/cache';

async function revalidateProducts() {
  'use server';
  revalidateTag('products');
}

export default async function Page() {
  const response = await fetch('https://api.vercel.app/products', {
    next: { revalidate: 60, tags: ['products'] }
  });
  const products = await response.json();
  
  return (
    <>
      <h1>{products[0].name}</h1>
      <form action={revalidateProducts}>
        <button type="submit">Revalidate</button>
      </form>
    </>
  );
}
```

**Key Patterns Validated:**
- **Time-based Revalidation**: 60 second cache
- **On-demand Revalidation**: revalidateTag usage
- **Cache Tags**: Tagged cache entries
- **Server Actions**: Cache invalidation action
- **Fetch Options**: Proper next config

**Success Criteria:**
- Fetch includes revalidate: 60
- revalidateTag imported and used
- Server action invalidates cache
- Products data fetched and displayed