# User Profile Component Evaluation Criteria

## Pass Criteria

The implementation passes if:

1. **User Data Display**: The UserProfile component displays both the user's name and email fetched from /api/users/profile

2. **Server-Side Data Fetching**: The component follows the same async server component pattern as the existing page.tsx (uses async/await for fetching, no 'use client' directive)

3. **No Client-Side Fetch Pattern**: The component does NOT use useEffect, useState, or client-side fetch patterns for initial data loading

4. **Integration**: The UserProfile component renders within the dashboard page alongside the existing ProductList

## Fail Criteria

The implementation fails if:

- The UserProfile component uses 'use client' directive with useEffect for data fetching
- The component uses useState to store fetched data
- The component shows "not implemented" or placeholder text
- The user's name and email are not displayed
- The component does not fetch from /api/users/profile
