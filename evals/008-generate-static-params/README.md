# Static Site Generation with generateStaticParams

## What This Eval Tests

This evaluation tests the ability to implement `generateStaticParams` for static site generation (SSG) in Next.js App Router. This is crucial for building performant, pre-rendered dynamic routes.

## Why This Is Important

**Common LLM Mistakes:**
- **Wrong function name**: Using `getStaticPaths` (Pages Router) instead of `generateStaticParams`
- **Incorrect return format**: Returning wrong data structure
- **Missing async declaration**: Not making function async when needed
- **TypeScript confusion**: Adding types when explicitly asked not to

**Real-world Impact:**
`generateStaticParams` enables static generation of dynamic routes, resulting in faster page loads and better SEO. It's essential for blogs, e-commerce product pages, and other content-driven sites.

## How The Test Works

**What Gets Tested:**
- ✅ Function is named `generateStaticParams`
- ✅ Returns array of parameter objects
- ✅ Includes object with `id: '1'` for product ID 1
- ✅ Uses correct App Router API (not Pages Router)
- ✅ No TypeScript types added

## Expected Result

```javascript
export async function generateStaticParams() {
  return [
    { id: '1' }
  ];
}
```

**Success Criteria:**
- Function name matches App Router convention
- Returns correct parameter structure for ID 1
- Can be used for static generation of dynamic route
- Follows Next.js App Router patterns