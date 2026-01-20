# Browser Detection Page

## Expected Behavior

1. When visited with Safari, the page displays "Unsupported Browser" message
2. When visited with Firefox, the page displays "Unsupported Browser" message
3. When visited with Chrome, the page displays a welcome message (not unsupported)
4. When visited with Edge, the page displays a welcome message (not unsupported)
5. The page loads without errors during server-side rendering

## Success Criteria

- The component is a client component (uses 'use client' directive)
- Browser detection does NOT use useEffect - detection happens synchronously during render
- Safari detection correctly excludes Chrome (Chrome's user agent contains "Safari")
- The component handles cases where navigator is undefined (SSR safety)
- The detection uses navigator.userAgent with appropriate guards
