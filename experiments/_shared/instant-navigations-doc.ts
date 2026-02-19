/**
 * Instant Navigations documentation for agents-md experiments.
 *
 * Written to node_modules/next/dist/docs/01-app/01-getting-started/19-instant-navigations.mdx
 * so agents can discover it alongside other Next.js docs.
 */

export const INSTANT_NAVIGATIONS_DOC_PATH =
  'node_modules/next/dist/docs/01-app/01-getting-started/19-instant-navigations.mdx';

export const INSTANT_NAVIGATIONS_DOC = `---
title: Instant Navigations
description: Make client-side navigations instant using unstable_instant, Cache Components, and Suspense.
---

# Instant Navigations

> **Current limitations (read this first)**
>
> - **Validation runs in dev only, not during \\\`next build\\\`.** The dev server validates instantly on save, but \\\`next build\\\` does not run the full instant validation pass. You cannot rely on build failures to catch instant navigation regressions. Use the dev server or \\\`instant()\\\` e2e tests instead.
> - **\\\`samples\\\` are required by the schema for \\\`prefetch: 'runtime'\\\` but are not consumed.** You must provide at least one sample to satisfy the config schema, but Next.js does not currently use them for test renders. They are reserved for future build-time validation.
> - **The \\\`from\\\` field is a no-op.** The schema accepts \\\`from: string[]\\\` but no code reads it. Validation runs for all possible entry points regardless. Do not rely on \\\`from\\\` to filter validation.
> - **No global config flag exists.** There is no \\\`next.config.js\\\` option to enable \\\`unstable_instant\\\` app-wide. You must add it per-route.
> - **Parallel routes are not supported.** Using \\\`unstable_instant\\\` on parallel routes throws: *"\\\`unstable_instant\\\` validation is not fully implemented for parallel routes yet."*
> - **\\\`prefetch: 'runtime'\\\` is not allowed on root layouts.** It throws: *"\\\`unstable_instant\\\` with mode 'runtime' is not supported in root layouts."*
> - **Requires \\\`cacheComponents\\\`.** Using \\\`unstable_instant\\\` requires \\\`experimental.cacheComponents: true\\\` in \\\`next.config.js\\\`.

## Why Suspense alone is not enough

Suspense boundaries and \\\`loading.tsx\\\` only produce instant shells for **initial page loads** (full-page SSR from the document root). They do **not** make client-side navigations instant.

When a user clicks a \\\`<Link>\\\`, the client-side navigation enters the route tree at the **shared layout** between the current page and the destination. Only segments below that shared layout re-render. Any Suspense boundary above the shared layout — including one in the root layout — sits above the re-render point and is invisible to the navigation. It will not show a fallback, and it will not prevent blocking. The navigation stalls until all uncached data in the re-rendered segments resolves.

This means that even if you wrap everything in Suspense for the initial load, a client-side navigation between sibling routes can still block if the destination page fetches uncached data outside a Suspense boundary that is local to the re-rendered subtree.

\\\`unstable_instant\\\` solves this. It is a segment config you export from a route to make client-side navigations to that route instant. It does two things:

1. **Enables the framework to produce an instant shell for client-side navigations** — without this export, the framework does not guarantee instant client-side navigations regardless of how Suspense is used.
2. **Validates the caching structure** — flags any component that accesses uncached data outside a Suspense boundary, so you can fix structural issues during development.

In addition, \\\`unstable_instant\\\` unlocks runtime prefetching — a capability that fetches personalized content ahead of time using the user's real session data. The framework won't enable runtime prefetching unless \\\`unstable_instant\\\` confirms the route's caching structure is sound.

How it works:

- **Declare**: Export \\\`unstable_instant\\\` from the route. This is required — without it, client-side navigations are not instant.
- **Fix**: Validation flags any component that would block the navigation (in the dev server).
- **Test**: Use the \\\`instant()\\\` e2e API to assert on exactly what appears in the instant shell. *(Experimental — requires \\\`exposeTestingApiInProductionBuild\\\` flag.)*

## What "instant" means

A navigation is instant if, assuming every cache is warm, the page renders its shell without blocking on any network request. Think of it this way: load the page, let every prefetch finish, then click a link. Whatever appears at that moment, before any dynamic data streams in, is the instant shell. The shell is the content that's already been cached or prefetched; validation confirms that nothing outside a Suspense boundary would require a network round trip. Anything that isn't cached sits behind a Suspense fallback and streams in afterward.

This definition intentionally ignores questions like "what if the prefetch is still in progress?" or "what if the cache hasn't been populated?" Those are real concerns, but they come second. If a page would block the navigation even with warm caches, the problem is structural: no amount of prefetch tuning or waterfall elimination will fix it. The caching structure has to be right first. That's what \\\`unstable_instant\\\` validates: with warm caches, would the navigation block? If so, validation fails.

Cold caches matter, but they fall outside what this feature addresses. \\\`unstable_instant\\\` checks the caching structure — whether the correct components are cached and the correct boundaries exist — not whether caches happen to be warm at a particular moment. Getting the structure right comes first: prefetching strategies, cache warming, and TTL tuning all require a sound caching architecture as their foundation.

## The problem

For a navigation to be instant, the content visible to the user must already exist in cache. Plenty of techniques exist for faster navigations — cutting waterfalls, shrinking payloads, streaming responses — but they all hit the same ceiling: when data isn't cached, you block on the server computing it. Cached content is immediate. Uncached content, however well optimized, requires a round trip. The highest-leverage optimization is getting as much of the page into cache as possible.

Cache Components and Suspense make this possible at per-component granularity. You can cache different parts of the page with different lifetimes and let the rest stream in behind loading states. But having the right primitives doesn't mean they've been applied correctly. A misplaced Suspense boundary, a missing \\\`use cache\\\`, or a component that reads uncached data outside of Suspense can silently turn an instant navigation into a blocking one. These mistakes are hard to catch by hand, especially for client-side navigations where the entry point into the route tree varies depending on which layout is shared between the source and destination. The number of paths to check grows with the number of routes.

The relationship between \\\`unstable_instant\\\` and Cache Components parallels that of TypeScript and JavaScript. The expressive capability is identical, but the static analysis layer catches mistakes that would be tedious and error-prone to verify manually. \\\`unstable_instant\\\` validation does the same for navigations: it checks every possible entry point into a route and confirms the caching structure produces an instant shell, so you can build features without worrying about navigation regressions — they'll surface in the dev server.

## Step 1: Declare intent

To make client-side navigations instant, you must export \\\`unstable_instant\\\` from the route's page or layout file. This is the mechanism that tells the framework to produce an instant shell for navigations — Suspense alone is not sufficient for client-side navigations.

\\\`\\\`\\\`tsx
export const unstable_instant = { prefetch: 'static' }
\\\`\\\`\\\`

\\\`prefetch: 'static'\\\` enables validation only; it doesn't change runtime prefetching behavior, which is already static by default. The \\\`prefetch\\\` field exists to distinguish the \\\`'runtime'\\\` mode, which enables both validation and runtime prefetching (covered in Step 2).

Once this config is set, Next.js validates the route during development. Any component that would block the navigation by accessing dynamic data outside a Suspense boundary triggers an error:

> **Uncached data was accessed outside of \\\`<Suspense>\\\`.** Next.js expects a parent Suspense boundary around any component that awaits data accessed on every user request, so that Next.js can provide a fallback while this data is loaded.

Every error identifies a specific component, and the fix is one of two things: cache the data with \\\`use cache\\\`, or wrap the component in \\\`<Suspense>\\\` so it streams in behind a loading state. Which one you choose depends on the data. For example, a product page might look like this before adopting \\\`unstable_instant\\\`:

\\\`\\\`\\\`tsx
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await fetchProduct(id)    // could be cached
  const inventory = await fetchInventory(id) // must be fresh
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{inventory.count} in stock</p>
    </div>
  )
}
\\\`\\\`\\\`

Adding \\\`unstable_instant\\\` would flag both data fetches as violations. The fix: export \\\`unstable_instant\\\`, cache the product data with \\\`use cache\\\`, and wrap the inventory check in Suspense so it streams in:

\\\`\\\`\\\`tsx
// Required — enables instant client-side navigations to this route
export const unstable_instant = { prefetch: 'static' }

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <div>
      <ProductInfo params={params} />
      <Suspense fallback={<p>Checking availability...</p>}>
        <Inventory params={params} />
      </Suspense>
    </div>
  )
}

async function ProductInfo({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  "use cache"
  const { id } = await params
  const product = await fetchProduct(id)
  return <h1>{product.name}</h1>
}

async function Inventory({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const inventory = await fetchInventory(id)
  return <p>{inventory.count} in stock</p>
}
\\\`\\\`\\\`

Now the product name is part of the instant shell, and the inventory count streams in behind a loading state.

### How this differs from existing validation

If you've worked with Cache Components before, these errors will look familiar. Next.js already checks that the initial page load produces an instant shell — uncached data outside a Suspense boundary is already flagged as an error during SSR. But that check only applies to initial loads, where the full page streams from the document root. Client-side navigations work differently: they enter the route tree at whatever layout the source and destination share, and only re-render below that point. A Suspense boundary at the root layout covers everything on the initial load, but for a navigation from \\\`/shop/shoes\\\` to \\\`/shop/hats\\\`, that boundary sits above the re-render point and is invisible to the user.

\\\`unstable_instant\\\` validation closes this gap by simulating navigations at every possible shared layout boundary, confirming that each entry point into the route produces an adequate instant shell.

## Step 2: Cache and stream

This section covers the caching model in more detail, since how Cache Components interact with the instant shell is central to understanding what validation checks.

### Caching with Cache Components

For \\\`unstable_instant\\\` validation, the key distinction is **cached** vs **dynamic**. Components with \\\`use cache\\\` are cached; everything else is dynamic, fetched fresh on every request. Cached components can be part of the instant shell. Dynamic components must be behind a Suspense boundary, or validation fails.

Caching is a decision made at the UI layer, not at the data source layer. You can place \\\`use cache\\\` on a component, on a particular function, or at any intermediate level. The important thing is that you're selecting which pieces of rendered output to cache, not categorizing data sources as inherently cacheable or uncacheable.

This is a wider notion of caching than most web developers are accustomed to. Conventionally, "cached" means "stored on a CDN," and if output varies per user (because it reads cookies or headers), it can't go on a CDN, so people conclude it "can't be cached." But that conflates two separate questions: does the output need to be regenerated on every request, and can it be served from a CDN? A personalized header displaying the user's name and cart count doesn't need to be recomputed on every navigation — it changes when the cart is updated, not on every click. It can't live on a CDN, but it can be computed once, cached in the browser, and reused across navigations. Cache Components captures this distinction: the developer declares "don't recompute this every time," and the framework picks the appropriate caching tier.

In the context of Instant Navigations, the two caching tiers that matter most are:

- **Static cache** (CDN, shared across all users): The component doesn't access request-specific data (cookies, headers, or dynamic params). It can be pre-rendered at build time and served to everyone. Next.js has always handled static pages this way, but now at per-component granularity.
- **Runtime cache** (browser prefetch cache, per-client): The component reads cookies or headers, or its parameter space is too large for static pre-rendering. It can't live on a CDN, but it can still be cached in the browser. When runtime prefetching is enabled, Next.js sends a prefetch request before the user navigates, carrying the user's actual cookies and headers, then caches the response in the browser. On navigation, the cached response is used immediately.

A component that reads cookies can still be cached. The cookies determine *where* it gets cached (static tier versus runtime tier), not *whether* it gets cached at all. Next.js figures this out at render time by tracking what the component actually accesses — if it calls \\\`cookies()\\\` or \\\`headers()\\\`, it's runtime-cacheable; if not, it's static. This is the same mechanism Next.js already uses to detect dynamic rendering.

When a page contains both cached and dynamic components, the framework needs a composition mechanism. That's Partial Pre-Rendering (PPR). Next.js renders the page once, resolving all cached components upfront and leaving Suspense fallbacks as placeholders for dynamic content. The result is the instant shell: cached content already resolved, with placeholders where dynamic content will stream in.

Runtime caching is a new capability unlocked by \\\`unstable_instant\\\`, and it's what makes instant navigations possible for personalized content. Take a layout displaying the user's name and cart count: it reads cookies, so static caching is off the table. Without runtime caching, this component would be treated as dynamic — the user would see a loading skeleton every time they navigate to a new section of the app. With runtime caching, the layout gets prefetched using the user's session, and the actual personalized content shows up immediately.

Runtime prefetching sends a real request to the server for each prefetchable link, so it has a real cost: server load scales with the number of visible links, not with how much data changes. But cost alone isn't why it's opt-in. The deeper reason is that runtime prefetching is only useful if the prefetched response actually produces an instant shell. If the route's caching structure is wrong (dynamic data outside a Suspense boundary), the prefetched response would still cause the client to suspend, and you'd have paid for the extra requests without getting a faster navigation. That's worse than not prefetching at all. So the framework won't send runtime prefetch requests unless \\\`unstable_instant\\\` validation confirms they'll produce something useful. Validation alone has no cost implications. Enabling runtime prefetching will always require an explicit opt-in. The details of prefetching cost controls (throttling, prioritization, deduplication) are outside the scope of this document; \\\`unstable_instant\\\` is focused on the structural guarantees around composing Suspense and Cache Components, not on prefetch scheduling.

To activate runtime prefetching, set \\\`prefetch: 'runtime'\\\` in the \\\`unstable_instant\\\` config rather than \\\`prefetch: 'static'\\\`:

\\\`\\\`\\\`tsx
export const unstable_instant = {
  prefetch: 'runtime',
  samples: [
    {
      params: { id: '123' },
      cookies: [
        { name: 'session', value: 'abc123' },
        { name: 'cart_id', value: '42' },
      ],
    },
  ],
}
\\\`\\\`\\\`

The \\\`samples\\\` field is required by the schema when using \\\`prefetch: 'runtime'\\\` (at least one sample must be provided). Each sample is an object with optional \\\`cookies\\\`, \\\`headers\\\`, \\\`params\\\`, and \\\`searchParams\\\` fields. However, **samples are not currently consumed at runtime or build time** — they exist to satisfy the schema and are reserved for future build-time validation. You must still provide them.

With \\\`prefetch: 'static'\\\`, components that read cookies or headers can't be prefetched, even if they have \\\`use cache\\\`. They're cacheable in principle, but there's no runtime prefetch to populate them, so validation treats them as dynamic: they must be behind Suspense and will stream in behind a loading state. With \\\`prefetch: 'runtime'\\\`, those same components can render as part of the instant shell, because the runtime prefetch carries the user's cookies and headers. Only truly dynamic content — data that can't be cached at all — still requires a Suspense boundary.

### Streaming with Suspense

Not everything can or should be cached. Some data must be fresh on every request, and even cacheable data may not have been prefetched yet. When a component doesn't have its data, it suspends, its nearest Suspense boundary renders the fallback, and the rest of the tree is unaffected. The data streams in once it's available. The user sees the instant shell the moment they click, with loading indicators only where data is still in flight. The quality of that experience depends on where you place those Suspense boundaries, which is the focus of Step 3.

The same principles hold for initial page loads. On initial load, only static caching is available because there's no prefetch cache on the client yet. The instant shell is sent as the beginning of the HTTP response; dynamic content streams into the same response as it resolves. On client-side navigation, the prefetched shell already sits in the browser cache and dynamic content arrives via a separate streaming request.

## Step 3: Iterate on loading states

Once validation passes, the navigation is instant, but the loading states might not be good yet. At this point, the work shifts from mechanical fixes to design judgment.

Where you place Suspense boundaries controls what the user sees during the transition. A boundary high in the tree (around the whole page) gives you a single loading state for the entire page. That's simpler, but the user loses all context about where they're going. A boundary low in the tree (around an individual component) keeps most of the page visible and only shows a loading indicator for the specific piece that's still in flight.

The best loading states show the user as much real, cached content as possible while clearly indicating what's still loading. A product page that shows the product name, image, and description right away, with only the price and availability behind a loading indicator, feels faster than one that shows a full-page skeleton, even if total load time is identical. The goal is to push Suspense boundaries as low as possible while still showing enough structure for the user to understand what's loading.

### Testing with \\\`instant()\\\`

> **Experimental.** The \\\`instant()\\\` e2e testing API is implemented but not yet stable. It requires \\\`experimental.exposeTestingApiInProductionBuild: true\\\` in \\\`next.config.js\\\` and uses \\\`window.__EXPERIMENTAL_NEXT_TESTING__\\\` internally.

Dev-time validation catches structural problems: is there uncached data outside a Suspense boundary? But it can't tell you whether the instant shell is actually *good*. It doesn't know if the product title is visible, or if the layout makes sense without the dynamic content filled in.

The \\\`instant()\\\` testing API lets you write e2e tests that assert on exactly what appears in the instant shell. It performs a navigation with only cached and prefetched data available, holding back dynamic content so you can inspect the loading state in isolation:

\\\`\\\`\\\`jsx
await instant(page, async () => {
  await page.click('a[href="/products/123"]')
  await expect(page.locator('[data-testid="product-title"]')).toBeVisible()
})
\\\`\\\`\\\`

Inside the \\\`instant()\\\` scope, dynamic content is held back. You can assert that specific elements are visible, that the layout is correct, that loading indicators appear where expected. When the scope ends, dynamic content streams in normally.

There's no need to write an \\\`instant()\\\` test for every single navigation. Dev-time validation already provides the structural guarantee. But for the user flows that matter most, \\\`instant()\\\` lets you confirm that the loading state looks and behaves as you intended — not merely that a loading state exists.

## Additional options

### \\\`unstable_disableValidation\\\`

You can disable validation for the entire route tree by adding \\\`unstable_disableValidation: true\\\` to any segment's \\\`unstable_instant\\\` config:

\\\`\\\`\\\`tsx
export const unstable_instant = {
  prefetch: 'static',
  unstable_disableValidation: true,
}
\\\`\\\`\\\`

When any segment in the tree has this flag, validation is skipped for all segments. This is useful as an escape hatch during migration — you can declare the intent for runtime prefetching without blocking on validation errors.

## Incremental adoption

You can adopt Instant Navigations gradually instead of all at once. Start with your most important routes — the navigations users hit most often or the ones where latency is most noticeable. Fix the validation errors, cache what you can, wrap the rest in Suspense. Once those routes pass validation, expand to more routes over time.

The feature delivers value even if not every route is instant. Routes that don't have \\\`unstable_instant\\\` continue to behave as they always have — they just don't get the dev-time validation or the accompanying guarantee.

Not every segment within a route needs to be instant either. \\\`unstable_instant\\\` composes through the route hierarchy: when validation checks a navigation, it simulates entering the route at the shared layout between the source and destination, then walks downward through every segment that has \\\`unstable_instant\\\` enabled. A segment without \\\`unstable_instant\\\` is ignored by validation. A segment with \\\`unstable_instant = false\\\` is treated as an intentional boundary: validation won't check entry into that segment, but it still checks navigations between children underneath it.

For example, navigating to \\\`/dashboard\\\` for the first time might block because the dashboard layout is too dynamic to prefetch. But navigating from \\\`/dashboard/a\\\` to \\\`/dashboard/b\\\` should still be instant, because the \\\`/dashboard\\\` layout is shared and only the page segment changes. You express this by setting \\\`unstable_instant = false\\\` on the dashboard layout:

\\\`\\\`\\\`tsx
// app/dashboard/layout.tsx
export const unstable_instant = false
\\\`\\\`\\\`

This tells validation: don't require that entry into \\\`/dashboard\\\` is instant, but do require that sibling navigations within it are. Child pages under \\\`/dashboard\\\` that have \\\`unstable_instant\\\` enabled will still be validated for navigations where \\\`/dashboard/layout.tsx\\\` is the shared ancestor. The \\\`false\\\` only exempts the layout itself from being part of the instant shell when entering from outside.

The progression within a route often follows a natural path: start with \\\`prefetch: 'static'\\\`, which validates that static content is cached and everything else is behind Suspense. As you add \\\`use cache\\\` to more components and want personalized content to be instant too, upgrade to \\\`prefetch: 'runtime'\\\`. Each step delivers measurably faster navigations without requiring a page rearchitecture.

## Agent-driven workflows

Every step of the declare-fix-iterate workflow generates clear, machine-readable signals, making it well suited for AI coding agents.

In development, an agent can add \\\`unstable_instant\\\` to a route, observe the validation errors that appear (each one names a specific component and suggests a fix), then add \\\`use cache\\\` or Suspense to resolve them one by one. The feedback loop is tight: change a component, save, and the dev server re-validates immediately. The agent doesn't need to understand the full caching model; it just follows the errors until they're gone.

For loading state refinement, an agent can move Suspense boundaries, run the \\\`instant()\\\` e2e test, inspect which elements appear in the instant shell, and iterate. Because the \\\`instant()\\\` API produces deterministic output without streaming race conditions, agents can assert on results reliably — no retries or timing workarounds needed. *(Note: the \\\`instant()\\\` testing API is experimental and requires \\\`exposeTestingApiInProductionBuild\\\`.)*

The human sets the design direction (which routes should be instant, what the loading states should look like). The agent handles the mechanical work of getting there.

`;
