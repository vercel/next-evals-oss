# Evaluation Criteria

This implementation should use Next.js 'use cache' directive for data caching with selective invalidation.

## Requirements

1. Has a component that fetches products using getAllProducts() from lib/db
2. Uses the 'use cache' directive to cache the product data
3. Uses cacheTag('products') to tag the cached data for selective invalidation
4. Has a form element with a submit button
5. The form uses a server action (with 'use server' directive)
6. The server action calls revalidateTag('products') to invalidate the cache
7. Products from the database are displayed on the page (Laptop, Phone, Tablet, etc.)
