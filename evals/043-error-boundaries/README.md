# Error Boundaries

## What This Eval Tests

This evaluation tests the ability to implement error boundaries in Next.js App Router using the error.tsx file convention for handling runtime errors.

## Why This Is Important

**Common LLM Mistakes:**
- **Missing 'use client'**: Error components must be client components
- **Wrong props**: Not receiving error and reset props correctly
- **File naming**: Using error.jsx or other names instead of error.tsx
- **No reset button**: Forgetting to implement reset functionality
- **Server component**: Making error.tsx a server component

**Real-world Impact:**
Error boundaries provide:
- Graceful error handling in production
- User-friendly error messages
- Recovery mechanisms with reset
- Preventing full app crashes
- Better debugging in development

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Creates error.tsx as client component
- ✅ Receives error and reset props
- ✅ Displays error message
- ✅ Includes reset button
- ✅ Page throws test error
- ✅ Button calls reset function

## Expected Result

**app/error.tsx:**
```tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h1>Something went wrong!</h1>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

**app/page.tsx:**
```tsx
export default function Page() {
  throw new Error('Test error');
}
```

**Key Patterns Validated:**
- **Client Component**: Uses 'use client' directive
- **Error Props**: Correctly typed error and reset
- **Reset Functionality**: Button implements recovery
- **Error Triggering**: Page demonstrates error

**Success Criteria:**
- error.tsx exists as client component
- Displays error message in h1
- Reset button calls reset function
- Page throws error to test boundary