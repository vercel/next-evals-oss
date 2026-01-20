# Server Component Product Display

## Expected Behavior

1. The page displays an h1 heading containing the name of the first product from the API
2. The product data is fetched from https://api.vercel.app/products
3. The page works without client-side JavaScript (server-rendered)

## Success Criteria

- An h1 element is visible on the page
- The h1 contains the name of the first product from the API response
- The component does not use 'use client' directive (it should be a server component)
