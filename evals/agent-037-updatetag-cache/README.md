# agent-037-updatetag-cache

This eval tests if the agent knows about Next.js's `updateTag()` function for read-your-own-writes cache invalidation.

## What it tests

- Does the agent use the `updateTag()` function from `next/cache`?
- Does the agent understand the difference between `updateTag()` and `revalidateTag()`?
- Can the agent correctly implement read-your-own-writes semantics?

## Why this is tricky

An agent trained on pre-Next.js 16 data will:
- Use `revalidateTag()` which has stale-while-revalidate semantics
- Not know about `updateTag()` at all
- Not understand that `updateTag()` waits for fresh data instead of serving stale

An agent with access to current Next.js docs will know that:
1. The `updateTag()` function exists in `next/cache`
2. It can ONLY be used in Server Actions (not Route Handlers)
3. It immediately expires cache and waits for fresh data
4. It's designed for read-your-own-writes scenarios
5. `revalidateTag()` serves stale content while revalidating in background

## Expected behavior with docs access

The agent should:
1. Import `updateTag` from `next/cache`
2. Use `updateTag()` in a Server Action after creating/updating data
3. NOT use `revalidateTag()` for immediate cache invalidation
