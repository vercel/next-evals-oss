# Client Component Dynamic Metadata (React 19)

## What This Eval Tests

This evaluation tests the ability to set page metadata from client components using React 19's new direct JSX metadata feature. This tests understanding of the latest React capabilities for dynamic metadata.

## Why This Is Important

**Common LLM Mistakes:**
- **Old patterns**: Using `next/head` or `useEffect` with document manipulation
- **Server component confusion**: Trying to use static metadata in client components
- **Missing 'use client'**: Not marking component as client-side
- **Incorrect JSX tags**: Using wrong element names or attributes

**Real-world Impact:**
React 19 introduced the ability to set metadata directly through JSX tags in client components. This enables dynamic metadata based on client-side state or user interactions.

## How The Test Works

**What Gets Tested:**
- ✅ Component has `'use client'` directive
- ✅ Uses React 19 JSX metadata tags (`<title>`, `<meta>`)
- ✅ Sets title to "My Page"
- ✅ Sets description meta tag to "Test"
- ✅ Renders metadata elements directly in JSX

## Expected Result

```tsx
'use client';

export default function ClientMeta() {
  return (
    <>
      <title>My Page</title>
      <meta name="description" content="Test" />
    </>
  );
}
```

**Success Criteria:**
- Client component properly sets page title
- Meta description is set correctly
- Uses React 19's direct JSX metadata approach
- Component renders without errors