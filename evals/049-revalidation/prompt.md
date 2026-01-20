I want to build a page that displays product data with caching and revalidation capabilities.

The page should:
- Fetch product data from https://api.vercel.app/products
- Display the first product's name in a heading
- Cache the data for 60 seconds before revalidating
- Have a button that allows manual cache invalidation to refresh the data on-demand
