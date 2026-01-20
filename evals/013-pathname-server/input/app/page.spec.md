# Server Component with Dynamic Route Parameters

## Expected Behavior

1. A dynamic route directory exists (e.g., `app/products/[id]/page.tsx`)
2. The page fetches product data from the API using the ID from the URL path
3. The product's name is displayed in a heading

## Success Criteria

- A dynamic route folder with bracket notation (e.g., `[id]` or `[productId]`) exists under `app/products/`
- The page component is a server component (no 'use client' directive)
- The page component is async and properly awaits the params prop (Next.js v15 pattern)
- The component fetches data from `https://api.vercel.app/products/[id]` using the route parameter
- The fetched product name is rendered in an h1 element
- The page correctly displays different products based on the URL path ID
