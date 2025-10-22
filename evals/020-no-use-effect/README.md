# No useEffect for Browser Detection Eval

## What this eval tests
This evaluation tests the ability to perform browser detection without using `useEffect`, demonstrating proper client-side initialization patterns in React.

## Why it's important
LLMs often struggle with:
- Overusing `useEffect` for one-time client-side operations
- Understanding that browser API access can be done directly in component body with proper guards
- Avoiding unnecessary re-renders caused by `useEffect` and `useState` combinations
- Using proper conditional rendering based on client-side detection
- Understanding hydration-safe patterns for browser-specific features

## How it works
The test validates that:
1. Component uses `'use client'` directive
2. Browser detection is performed without `useEffect`
3. Navigator API is accessed safely with proper checks
4. Component renders different content based on browser detection
5. No unnecessary state management or side effects are used

## Expected result
The implementation should perform browser detection directly in the component:

```typescript
'use client';

export default function BrowserCheck() {
  // Direct browser detection without useEffect
  const isSafari = typeof navigator !== 'undefined' && 
    /Safari/.test(navigator.userAgent) && 
    !/Chrome/.test(navigator.userAgent);
    
  const isFirefox = typeof navigator !== 'undefined' && 
    /Firefox/.test(navigator.userAgent);

  if (isSafari || isFirefox) {
    return (
      <div>
        <h1>Unsupported Browser</h1>
        <p>This application is not supported on Safari or Firefox.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Welcome</h1>
      <p>Your browser is supported!</p>
    </div>
  );
}
```

## Success criteria
- Component uses `'use client'` directive
- No `useEffect` hook used for browser detection
- Navigator API accessed with proper `typeof` guards
- Browser detection logic implemented directly in component body
- Conditional rendering based on browser type
- No unnecessary state management for one-time detection