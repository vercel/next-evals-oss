I want to build a product detail page that displays a single product based on its ID in the URL.

The page should:
- Use a dynamic route like /products/[id] to capture the product ID from the URL
- Fetch the product data from https://api.vercel.app/products/[id] using the ID from the URL path
- Display the product's name in a heading
- Work as a server-rendered page (no client-side JavaScript needed for data fetching)