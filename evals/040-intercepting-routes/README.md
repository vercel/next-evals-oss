# Intercepting Routes

## What This Eval Tests

This evaluation tests the ability to implement intercepting routes in Next.js App Router. Intercepting routes allow you to load a route within the context of the current layout while preserving the URL.

## Why This Is Important

**Common LLM Mistakes:**
- **Wrong convention**: Not using correct intercepting route syntax (.)
- **Missing parallel route**: Forgetting to create parallel route for modal
- **Incorrect folder structure**: Placing intercepting route in wrong location
- **No fallback route**: Not creating the regular route that gets intercepted
- **Client-side navigation**: Not understanding intercepting only works with client navigation

**Real-world Impact:**
Intercepting routes enable:
- Modal overlays that preserve context
- Photo galleries with lightbox effects
- Quick previews without full navigation
- Progressive enhancement patterns

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Creates intercepting route with (.) convention
- ✅ Creates regular route for direct access
- ✅ Intercepting route shows modal view
- ✅ Regular route shows full page view
- ✅ Correct folder structure and naming
- ✅ Proper className attributes

## Expected Result

**app/(.)photo/[id]/page.tsx:**
```tsx
export default function PhotoModal({ params }: { params: { id: string } }) {
  return <div className="modal">Photo {params.id} Modal</div>;
}
```

**app/photo/[id]/page.tsx:**
```tsx
export default function PhotoPage({ params }: { params: { id: string } }) {
  return <div className="page">Photo {params.id} Page</div>;
}
```

**Key Patterns Validated:**
- **Intercepting Convention**: Uses (.) for same-level interception
- **Dynamic Routes**: Both routes handle [id] parameter
- **Different Views**: Modal vs page rendering
- **Folder Organization**: Correct placement of routes

**Success Criteria:**
- Intercepting route exists with correct syntax
- Regular route provides fallback
- Both routes handle dynamic parameters
- Different content for intercepted vs direct access