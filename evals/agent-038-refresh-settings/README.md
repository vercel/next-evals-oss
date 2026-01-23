# agent-038-refresh-settings

This eval tests if the agent knows how to refresh the current page from within a Server Action using Next.js's recommended approach.

## What it tests

- Does the agent use `revalidatePath()` from `next/cache` to refresh the page?
- Does the agent avoid using `redirect()` when only a refresh is needed?
- Does the agent properly structure the Server Action to trigger a page refresh?

## Why this is tricky

An agent without proper Next.js knowledge might:
- Use `redirect()` to the same page (causes full navigation, loses scroll position)
- Return data and expect the client to manually refresh
- Use client-side `router.refresh()` instead of handling it in the Server Action
- Not know about `revalidatePath()` for cache invalidation

An agent with access to current Next.js docs will know that:
1. `revalidatePath()` from `next/cache` can refresh the current page's data
2. Calling `revalidatePath('/')` or the specific path triggers a server-side refresh
3. This is the idiomatic way to refresh after mutations in Server Actions
4. It preserves client state and scroll position unlike `redirect()`

## Expected behavior with docs access

The agent should:
1. Create a Server Action that toggles the notification preference
2. Import `revalidatePath` from `next/cache`
3. Call `revalidatePath()` with the current path after the mutation
4. NOT use `redirect()` since the requirement is to stay on the same page
