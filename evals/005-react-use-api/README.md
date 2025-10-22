# React use() API with Promise Data

## What This Eval Tests

This evaluation tests the ability to use React's experimental `use()` API to consume Promise data in client components. This tests understanding of the latest React concurrent features.

## Why This Is Important

**Common LLM Mistakes:**
- **useEffect for Promises**: Using traditional async patterns instead of `use()`
- **Missing 'use client' directive**: Not marking component as client-side
- **Promise handling errors**: Not properly unwrapping Promise data
- **Suspense boundary issues**: Not understanding Suspense requirements
- **JSON serialization**: Incorrect data transformation

**Real-world Impact:**
The `use()` API is React's future for handling async data in components. It enables better streaming, concurrent rendering, and simplifies async state management compared to useEffect patterns.

## How The Test Works

**What Gets Tested:**
- ✅ Component has `'use client'` directive
- ✅ Imports and uses `use()` hook from React
- ✅ Correctly unwraps Promise data
- ✅ Renders data as JSON string
- ✅ Handles Promise consumption properly
- ✅ Page wraps the client component in a `<Suspense>` boundary

## Expected Result

```tsx
'use client';

import { use } from 'react';

interface ClientComponentProps {
  data: Promise<any>;
}

export default function ClientComponent({ data }: ClientComponentProps) {
  const resolvedData = use(data);
  
  return <div>{JSON.stringify(resolvedData)}</div>;
}
```

```tsx
import { Suspense } from 'react';
import ClientComponent from './ClientComponent';

export default function Page() {
  const data = getData();
  return (
    <Suspense>
      <ClientComponent data={data} />
    </Suspense>
  );
}
```

**Success Criteria:**
- Client component properly uses React's `use()` API
- Promise data is unwrapped and displayed as JSON
- Component handles async data correctly
- No useEffect or useState needed for Promise handling
- Page component uses `<Suspense>` when rendering the client component
