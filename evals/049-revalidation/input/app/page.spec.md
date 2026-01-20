# Revalidation Page

## Expected Behavior

1. The page displays an h1 heading containing the name of the first product from the API
2. The product data is fetched from https://api.vercel.app/products
3. The data is cached with time-based revalidation (60 seconds)
4. There is a form with a button to manually trigger cache revalidation
5. The page works as a server component (data fetching happens server-side)

## Success Criteria

- An h1 element is visible on the page showing the first product's name
- The h1 text matches the first product name from the API response
- A form element exists with a submit button for revalidation
- The revalidation button is clickable and the page remains functional after clicking
- The component uses Next.js App Router patterns for caching (fetch with next.revalidate option)
- The manual revalidation uses a server action with revalidateTag
- Cache tags are used to enable on-demand revalidation
