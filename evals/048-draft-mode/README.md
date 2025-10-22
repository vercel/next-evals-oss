# Draft Mode

## What This Eval Tests

This evaluation tests the ability to implement draft mode in Next.js App Router for previewing draft content from headless CMS systems.

## Why This Is Important

**Common LLM Mistakes:**
- **Wrong import**: Using draftMode from wrong package
- **Client component**: Using draftMode in client components
- **API route location**: Wrong path for draft API
- **No redirect**: Forgetting to redirect after enabling
- **Cookie handling**: Manual cookie management instead of draftMode()

**Real-world Impact:**
Draft mode enables:
- CMS preview functionality
- Content preview before publishing
- Conditional rendering based on draft state
- Secure preview URLs
- Better content workflow

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Imports draftMode from next/headers
- ✅ Checks draft mode state
- ✅ Conditionally renders content
- ✅ Creates API route for draft
- ✅ Enables draft mode in API
- ✅ Redirects after enabling

## Expected Result

**app/page.tsx:**
```tsx
import { draftMode } from 'next/headers';

export default function Page() {
  const { isEnabled } = draftMode();
  
  return (
    <h1>
      Draft Mode: {isEnabled ? 'ON' : 'OFF'}
    </h1>
  );
}
```

**app/api/draft/route.ts:**
```tsx
import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET() {
  draftMode().enable();
  redirect('/');
}
```

**Key Patterns Validated:**
- **Server Component**: Uses draftMode in server
- **Draft State Check**: Accesses isEnabled property
- **API Route**: Creates draft enabling endpoint
- **Conditional Rendering**: Shows different content
- **Redirect**: Returns to page after enable

**Success Criteria:**
- draftMode imported and used correctly
- Conditional draft mode display
- API route enables draft mode
- Proper redirects implemented