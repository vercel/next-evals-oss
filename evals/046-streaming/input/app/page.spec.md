# Streaming Dashboard Evaluation Criteria

## Expected Behavior

1. The page displays a "Dashboard" heading in an h1 element immediately on load
2. While slow data is loading, the page shows "Loading data..." as a fallback
3. After the data finishes loading (~3 seconds), "Data loaded!" is displayed
4. The Dashboard header remains visible throughout the entire loading process

## Success Criteria

- An h1 element containing "Dashboard" is visible immediately when the page loads
- A loading state with "Loading data..." text is shown while waiting for slow content
- After approximately 3 seconds, "Data loaded!" appears on the page
- The h1 header never disappears or reloads during the streaming process
- The page uses React Suspense for streaming (the slow component should be wrapped in Suspense)

## Fail Criteria

The implementation fails if:

- The Dashboard header is not visible immediately on page load
- No loading indicator is shown while waiting for the slow content
- The "Data loaded!" message never appears
- The entire page blocks until all data is loaded (no streaming behavior)
- The header disappears or flickers during the loading process
