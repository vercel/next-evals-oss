# Error Boundary Page Specification

## Expected Behavior

When a user visits the home page:

1. **Error Display**: The page should show an error message with "Something went wrong!" as the main heading (h1 element)

2. **Recovery Button**: A "Try again" button should be visible that allows users to attempt recovery from the error

3. **Button Functionality**: Clicking the "Try again" button should attempt to re-render the page component (which will trigger the error again in this test scenario)

## Implementation Requirements

- The error boundary must be implemented as an `error.tsx` file in the app directory
- The error component must be a client component (using 'use client' directive)
- The page component should throw an error to demonstrate the error boundary catching it
- The error boundary should receive and use the `reset` function prop for the retry functionality
