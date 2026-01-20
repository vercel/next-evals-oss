# Evaluation Criteria

This implementation should use programmatic navigation via the Next.js App Router.

## Requirements

1. Uses `'use client'` directive - required for client-side hooks and event handlers
2. Imports `useRouter` from `'next/navigation'` (App Router), NOT from `'next/router'` (Pages Router)
3. Calls the `useRouter()` hook to get the router instance
4. Has a button with the text "Navigate"
5. Clicking the button calls `router.push('/about')` or similar router method to navigate
6. Does NOT use `<Link>` component for this navigation (the requirement is for programmatic navigation)
7. Does NOT use any Pages Router patterns like `router.pathname`, `router.query`, or `router.asPath`
