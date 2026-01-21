# 029 - Use Cache Directive

## Overview

This eval tests the implementation of React's `use cache` directive for server-side caching in Next.js applications. The `use cache` directive is a React feature that enables caching of async function results with cache tags for selective invalidation.

## What it tests

The eval validates that the AI can:

1. **Implement `use cache` directive**: Create components that use the `use cache` directive to cache async data fetching operations
2. **Use cache tags**: Properly implement cache tagging with `cacheTag()` for organized cache management
3. **Database integration**: Fetch data using a provided database function (`getAllProducts()` from `lib/db`) instead of external APIs
4. **Cache invalidation**: Create server actions that use `revalidateTag()` to selectively invalidate cached data
5. **Form integration**: Build forms that trigger server actions for cache invalidation

## Key concepts tested

- **`use cache` directive**: React's experimental caching feature for server components
- **Cache tags**: Organizing cached data with semantic tags like "products"
- **Server actions**: Functions that run on the server and can invalidate caches
- **Cache invalidation**: Using `revalidateTag()` to refresh specific cached data
- **Database abstraction**: Working with provided data access functions instead of direct API calls

## Expected implementation

The solution should include:
- A React Server Component that fetches product data using `getAllProducts()`
- Implementation of `use cache` directive with appropriate cache tags
- A server action that invalidates the "products" cache tag
- A form that calls the server action to trigger cache invalidation
- Proper Next.js configuration to support the `use cache` directive

## Learning objectives

This eval helps assess understanding of:
- Modern React caching patterns
- Server-side data management in Next.js
- Cache invalidation strategies
- Server actions and form handling
- Database abstraction patterns

The eval simulates real-world scenarios where applications need efficient data caching with selective invalidation capabilities.