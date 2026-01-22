# agent-033-forbidden-auth

This eval tests if the agent knows about Next.js's `forbidden()` function and `forbidden.tsx` file convention.

## What it tests

- Does the agent use the `forbidden()` function from `next/navigation`?
- Does the agent enable `authInterrupts: true` in next.config?
- Does the agent create a `forbidden.tsx` error boundary file?

## Why this is tricky

An agent trained on pre-Next.js 15.1 data will:
- Use `redirect()` to redirect unauthorized users
- Throw a custom error or use `notFound()`
- Return a Response with 403 status manually
- Not know about the `forbidden.tsx` file convention

An agent with access to current Next.js docs will know that:
1. The `forbidden()` function exists in `next/navigation`
2. It requires `authInterrupts: true` in next.config experimental
3. A `forbidden.tsx` file can be created for custom UI
4. It automatically returns proper HTTP 403 status code

## Expected behavior with docs access

The agent should:
1. Enable `authInterrupts: true` in next.config.experimental
2. Import `forbidden` from `next/navigation`
3. Call `forbidden()` when user is not admin
4. Create `app/forbidden.tsx` for custom error UI
