# agent-039-indirect-proxy

This eval tests if the agent knows that in Next.js 16+, the way to intercept all requests is through `proxy.ts` - but with an indirect prompt that doesn't mention proxy or middleware.

## What it tests

- Does the agent know that logging all requests requires the proxy layer?
- Does the agent create `proxy.ts` (new convention) or `middleware.ts` (deprecated)?
- Does the agent use the `proxy` function name instead of `middleware`?

## Why this is tricky

The prompt simply says "log every request to console" without mentioning:
- Proxy
- Middleware
- Where to put the file
- What function to export

An agent trained on pre-Next.js 16 data will create `middleware.ts` with a `middleware` function.
An agent with access to current Next.js docs will know that:
1. The file should be named `proxy.ts`
2. The function should be named `proxy` (not `middleware`)
3. This is the appropriate place to intercept all requests

## How it differs from agent-031-proxy-middleware

The agent-031 eval explicitly asks for "middleware" functionality, which is a more direct hint.
This eval only asks to "log every request" - the agent must infer that proxy.ts is the right tool.

## Expected behavior with docs access

The agent should:
1. Recognize this requires request interception
2. Create `proxy.ts` in the project root
3. Export a `proxy` function (not `middleware`)
4. Use `NextRequest` from `next/server`
5. Log the request path/URL to console
