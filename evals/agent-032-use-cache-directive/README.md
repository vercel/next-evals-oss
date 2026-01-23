# agent-032-use-cache-directive

This eval tests if the agent knows about Next.js 16's new 'use cache' directive and Cache Components feature.

## What it tests

- Does the agent use the `'use cache'` directive?
- Does the agent enable `cacheComponents: true` in next.config?
- Does the agent use `cacheLife` and `cacheTag` functions properly?

## Why this is tricky

An agent trained on pre-Next.js 16 data will:
- Use `fetch()` with `{ next: { revalidate: 3600 } }` option
- Use route segment config like `export const revalidate = 3600`
- Use `unstable_cache` or other deprecated caching approaches

An agent with access to current Next.js docs will know that:
1. The new approach uses `'use cache'` directive
2. Requires `cacheComponents: true` in next.config
3. Uses `cacheLife('hours')` or custom time config
4. Uses `cacheTag('posts')` for on-demand invalidation

## Expected behavior with docs access

The agent should:
1. Enable `cacheComponents: true` in next.config
2. Use `'use cache'` directive at the top of the component or function
3. Use `cacheLife` function to set cache duration
4. Use `cacheTag` function to tag the cache
