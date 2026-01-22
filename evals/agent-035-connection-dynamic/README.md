# agent-035-connection-dynamic

This eval tests if the agent knows about Next.js's `connection()` function for forcing dynamic rendering.

## What it tests

- Does the agent use the `connection()` function from `next/server`?
- Does the agent understand that `connection()` replaces `unstable_noStore`?
- Can the agent correctly force dynamic rendering for components using `Math.random()` or `new Date()`?

## Why this is tricky

An agent trained on pre-Next.js 15 data will:
- Use `unstable_noStore()` which is deprecated
- Use `export const dynamic = 'force-dynamic'` segment config
- Not know about the `connection()` function at all
- Try to use cookies/headers just to trigger dynamic rendering

An agent with access to current Next.js docs will know that:
1. The `connection()` function exists in `next/server`
2. It returns a Promise that must be awaited
3. It replaces `unstable_noStore` for forcing dynamic rendering
4. It's the proper way to opt-out of static prerendering without using Dynamic APIs

## Expected behavior with docs access

The agent should:
1. Import `connection` from `next/server`
2. Call `await connection()` before using `Math.random()` or `new Date()`
3. NOT use `unstable_noStore` (deprecated)
