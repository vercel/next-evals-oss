# agent-031-proxy-middleware

This eval tests if the agent knows that in Next.js 16+, the middleware.ts file convention has been renamed to proxy.ts.

## What it tests

- Does the agent create `proxy.ts` (new convention) or `middleware.ts` (deprecated)?
- Does the agent use the `proxy` function name instead of `middleware`?

## Why this is tricky

An agent trained on pre-Next.js 16 data will create `middleware.ts` with a `middleware` function.
An agent with access to current Next.js docs will know that:
1. The file should be named `proxy.ts`
2. The function should be named `proxy` (not `middleware`)

## Expected behavior with docs access

The agent should:
1. Create `proxy.ts` in the project root
2. Export a `proxy` function (not `middleware`)
3. Use `NextResponse` from `next/server`
