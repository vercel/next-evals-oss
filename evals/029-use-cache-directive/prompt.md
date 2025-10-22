Implement efficient data caching with selective invalidation for a product listing. Update app/page.tsx to:
- Create a child component that fetches product data using getAllProducts() from lib/db
- Cache the data using the 'use cache' directive with a "products" cache tag
- Include a form with an inline server action that invalidates the "products" cache when submitted
- Demonstrate proper cache invalidation patterns for dynamic data updates
