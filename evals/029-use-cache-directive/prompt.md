I want to build a product listing page with caching and cache invalidation.

The page should:
- Display a list of products fetched from the database (use getAllProducts() from lib/db)
- Cache the product data so it doesn't re-fetch on every request
- Have a "Refresh Products" button that invalidates the cache and shows fresh data
- The cache should use a "products" tag so it can be selectively invalidated
