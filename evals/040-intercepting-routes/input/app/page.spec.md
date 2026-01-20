# Evaluation Criteria

This implementation should use Next.js intercepting routes to show a modal when navigating within the app, but a full page on direct URL access.

## Requirements

1. Main page has a Link component (from next/link) pointing to /photo/1
2. Uses intercepting route convention to intercept the /photo/[id] route (can use (.) prefix or parallel routes pattern with @modal slot)
3. Has a regular route at app/photo/[id]/page.tsx for direct URL access
4. Clicking the link shows "Modal" text indicating the intercepted modal view
5. Direct navigation to /photo/1 shows "Page" text indicating the full page view
6. Both dynamic routes properly access the id parameter from params
7. The different content between modal and page views demonstrates that interception is working
