# agent-034-async-cookies

This eval tests if the agent knows that in Next.js 16, `cookies()` and `headers()` are async and must be awaited.

## What it tests

- Does the agent properly `await cookies()` before accessing values?
- Does the agent properly `await headers()` before accessing values?
- Does the agent use the correct async pattern?

## Why this is tricky

An agent trained on Next.js 15 data will:
- Call `cookies()` synchronously: `const cookieStore = cookies()`
- Call `headers()` synchronously: `const headersList = headers()`
- Not use await for these functions

An agent with access to Next.js 16 docs will know that:
1. `cookies()` now returns a Promise and must be awaited
2. `headers()` now returns a Promise and must be awaited
3. This is a breaking change from Next.js 15

## Breaking change details

From the Next.js 16 upgrade guide:
> Starting with Next.js 16, synchronous access is fully removed. These APIs can only be accessed asynchronously.

## Expected behavior with docs access

The agent should:
1. Use `await cookies()` to get the cookie store
2. Use `await headers()` to get the headers list
3. Make the component or function async
