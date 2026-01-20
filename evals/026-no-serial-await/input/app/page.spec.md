# Dashboard with Parallel Data Fetching

## Expected Behavior

1. The Dashboard component fetches data from three APIs: /api/analytics, /api/notifications, and /api/settings
2. All three data sources are displayed on the page
3. Data fetching is done efficiently using parallel requests (not sequential)

## Success Criteria

- The Dashboard component uses `Promise.all` or `Promise.allSettled` to fetch data from all three APIs in parallel
- The component does NOT use sequential awaits (e.g., `await fetch(...); await fetch(...); await fetch(...)`)
- The component is an async server component (no 'use client' directive)
- The page displays information from analytics, notifications, and settings data
- The implementation follows the existing parallel fetching pattern shown in page.tsx
