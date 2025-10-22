# Client Component with State Management

## What This Eval Tests

This evaluation tests the ability to create interactive client components in Next.js App Router using React state management. This tests the fundamental distinction between server and client components.

## Why This Is Important

**Common LLM Mistakes:**
- **Missing 'use client' directive**: Forgetting to mark component as client-side
- **Server component confusion**: Trying to use hooks in server components
- **State management errors**: Incorrect useState implementation
- **Event handling issues**: Not properly binding click handlers

**Real-world Impact:**
Understanding when and how to use client components is crucial for building interactive Next.js applications. Client components handle user interactions, browser APIs, and dynamic state updates.

## How The Test Works

**What Gets Tested:**
- ✅ Component has `'use client'` directive
- ✅ Uses `useState` hook for counter state
- ✅ Implements increment/decrement functionality
- ✅ Renders current count value
- ✅ Handles button click events properly

## Expected Result

```tsx
'use client';

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(count - 1)}>-</button>
    </div>
  );
}
```

**Success Criteria:**
- Component is properly marked as client-side
- State management works correctly
- User interactions update the counter
- Component renders and functions properly