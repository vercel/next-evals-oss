# React use() API Evaluation Criteria

## Pass Criteria

The implementation passes if:

1. **Data Display**: The page displays the fetched data as a JSON string containing `{"test":"data","message":"Hello from promise"}`

2. **Suspense Boundary**: The page uses a Suspense boundary to handle the loading state while the promise resolves

3. **React use() Hook**: The client component uses React's `use()` hook to unwrap the promise passed from the server component

4. **Client/Server Separation**: The data fetching happens in the server component and the promise is passed to a client component for rendering

## Fail Criteria

The implementation fails if:

- The data is not displayed on the page
- The page crashes or shows an error
- The page awaits the promise in the server component instead of passing it to the client
- No Suspense boundary is present (will cause the page to crash when using `use()`)
