# agent-036-after-response

This eval tests if the agent knows about Next.js's `after()` function for scheduling work after the response is sent.

## What it tests

- Does the agent use the `after()` function from `next/server`?
- Does the agent understand that `after()` runs code after the response is finished?
- Can the agent correctly use `after()` for logging/analytics without blocking the response?

## Why this is tricky

An agent trained on pre-Next.js 15.1 data will:
- Use `waitUntil()` from Vercel-specific APIs
- Try to use `setTimeout()` or fire-and-forget promises
- Not know about the `after()` function at all
- Try to log synchronously which blocks the response

An agent with access to current Next.js docs will know that:
1. The `after()` function exists in `next/server`
2. It accepts a callback that runs after the response is sent
3. It's designed for tasks that shouldn't block the response
4. It works in Server Components, Server Actions, and Route Handlers

## Expected behavior with docs access

The agent should:
1. Import `after` from `next/server`
2. Call `after(() => { /* logging code */ })`
3. NOT block the response with logging operations
