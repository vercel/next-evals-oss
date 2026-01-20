# Evaluation Criteria

This implementation should use Next.js intercepting routes to show a modal when navigating within the app, but a full page on direct URL access.

## Requirements

1. Main page has a Link component (from next/link) pointing to /photo/1
2. Uses intercepting route convention with (.) prefix folder to intercept the /photo/[id] route
3. The intercepting route folder structure is app/(.)photo/[id]/page.tsx
4. The regular route folder structure is app/photo/[id]/page.tsx
5. The intercepting route page displays "Photo 1 Modal" (or "Photo {id} Modal") in an element with className="modal"
6. The regular route page displays "Photo 1 Page" (or "Photo {id} Page") in an element with className="page"
7. Both dynamic routes properly access the id parameter from params
8. The layout.tsx properly renders both the main content and the intercepted modal slot (if using parallel routes pattern)
