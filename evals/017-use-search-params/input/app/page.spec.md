# Evaluation Criteria

This page should display URL search parameters using the useSearchParams hook correctly.

## Requirements

1. Uses useSearchParams hook from 'next/navigation' to read the query parameter
2. Component using useSearchParams has 'use client' directive (required for client hooks)
3. The useSearchParams component is wrapped in a Suspense boundary (required to prevent hydration errors)
4. Displays the "query" search param value in an element with data-testid="search-display"
5. Handles missing/empty query parameter gracefully without errors
6. Page builds and runs without hydration errors or Next.js warnings
