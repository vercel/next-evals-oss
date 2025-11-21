# NextJS Eval Results

Run using Codex CLI one-shot. Failures were followed up with Claude Code.

- **000-app-router-migration-simple**: ✅ PASS - no changes.
- **001-server-component:** ❌ FAIL - hard-coded JSON regex in the test.
- **002-client-component:** ✅ PASS - no changes.
- **003-cookies:** ❌ FAIL - Codex failed to implement according to NextJS 15 patterns.
- **004-search-params:** ✅ PASS - no changes.
- **005-react-use-api:** ☑️ PASS - but `any` type is not allowed so lint failed.
- **006-server-metadata:** ✅ PASS - no changes.
- **007-client-metadata:** ✅ PASS - no changes.
- **008-generate-static-params:** ☑️ PASS - but linting failed. See footnote [1].
- **009-og-images:** ✅ PASS - no changes.
- **010-route-handlers:** ✅ PASS - no changes.
- **011-client-server-form:** ❌ FAIL - refactored tests and they passed. See footnote [2].
- **012-parallel-routes:** ❌ FAIL - refactored tests and they passed. See footnote [3].
- **013-pathname-server:** ❌ FAIL - see footnote [4].
- **014-server-routing:** ✅ PASS - no changes.
- **015-server-actions-exports:** ❌ FAIL - see footnote [5].
- **016-client-cookies:** ❌ FAIL - see footnote [6].
- **017-use-search-params:** ❌ FAIL - see footnote [7].
- **018-use-router:** ✅ PASS - no changes.
- **019-use-action-state:** ❌ FAIL - see footnote [8].
- **020-no-use-effect:**
- **021-avoid-fetch-in-effect:**
- **022-prefer-server-actions:**
- **023-avoid-getserversideprops:**
- **024-avoid-redundant-usestate:**
- **025-prefer-next-link:**
- **026-no-serial-await:**
- **027-prefer-next-image:**
- **028-prefer-next-font:**
- **029-use-cache-directive:**
- **030-app-router-migration-hard:**
- **031-ai-sdk-migration-simple:**
- **032-ai-sdk-model-specification-string:**
- **033-ai-sdk-v4-model-specification-function:**
- **034-ai-sdk-render-visual-info:**
- **035-ai-sdk-call-tools:**
- **036-ai-sdk-call-tools-multiple-steps:**
- **037-ai-sdk-embed-text:**
- **038-ai-sdk-mcp:**
- **039-parallel-routes:**
- **040-intercepting-routes:**
- **041-route-groups:**
- **042-loading-ui:**
- **043-error-boundaries:**
- **044-metadata-api:**
- **045-server-actions-form:**
- **046-streaming:**
- **047-middleware:**
- **048-draft-mode:**
- **049-revalidation:**

# Footnotes

## [1]:

The prompt is misleading. It should say:

- "Add the generateStaticParams function to the existing page file"

Instead of:

- "Do not include the page React component, only the generateStaticParams function"

The correct implementation needs BOTH:

1. generateStaticParams() function ✓ (Codex has this)
2. Default page component export ✗ (Codex missing this - followed bad prompt)

The tests don't catch this because they only do shallow string matching rather than actual imports.

## [2]:

**Status**: ❌ Tests fail (but implementation correct!)

**Problem**:

- Model correctly extracted components following best practices:
  - `page.tsx` - server component
  - `contact-form.tsx` - client component
  - `actions.ts` - server actions
- Tests only checked `page.tsx` directly

**Solution**: Updated tests to recursively check imports and actions files.

## [3]:

Summary of Changes

Updated evals/012-parallel-routes/output-codex/app/page.test.tsx to support both implementation patterns:

What Changed:

1. Directory structure test - Now checks both locations:

- ✅ app/@analytics OR app/dashboard/@analytics
- ✅ app/@settings OR app/dashboard/@settings

2. Layout props test - Now checks both layouts:

- Prioritizes app/dashboard/layout.tsx if it exists
- Falls back to app/layout.tsx

3. Content test - Now checks both patterns:

- Looks in root parallel routes first
- Falls back to dashboard parallel routes

4. Render test - Now checks both layouts:

- Same logic as test #2

Key Pattern:

// Before (brittle):
const path = join(process.cwd(), 'app', '@analytics');
expect(existsSync(path)).toBe(true);

// After (flexible):
const rootPath = join(process.cwd(), 'app', '@analytics');
const dashboardPath = join(process.cwd(), 'app', 'dashboard', '@analytics');
expect(existsSync(rootPath) || existsSync(dashboardPath)).toBe(true);

This follows the EVAL_DEBUGGING.md principle: "Tests should support both inline and extracted component patterns" - in this case, both
root-level and nested parallel route patterns.

## [4]:

Summary: Eval 013-pathname-server Fixes

Results:

- ✅ Build succeeds
- ✅ No ESLint errors
- ✅ All 4 tests pass

---

Issues Fixed:

1. Build Error: headers() API change (app/products/[id]/page.tsx:13)

Problem: In Next.js 15, headers() returns a Promise
// Before (Next.js 14 style):
const host = headers().get('host');

// After (Next.js 15 style):
const host = (await headers()).get('host');

---

2. Test Error: Only checked one directory level (app/page.test.tsx)

Problem: Test only searched app/ for dynamic routes, but actual structure was app/products/[id]/

Solution: Added recursive search helper:
function findDynamicRoute(dir: string): string | null {
const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('[') && entry.name.endsWith(']')) {
        return join(dir, entry.name);
      }

      // Recursively search subdirectories
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const result = findDynamicRoute(join(dir, entry.name));
        if (result) return result;
      }
    }

    return null;

}

This makes tests flexible - they now support:

- ✅ Root-level dynamic routes: app/[id]/page.tsx
- ✅ Nested dynamic routes: app/products/[id]/page.tsx

---

3. Lint Error: any types in tests

Problem: Tests used (entry: any) in 4 places

Solution: Removed explicit typing by using the helper function, which properly infers types from readdirSync(..., { withFileTypes: true
})

---

Pattern Applied (from EVAL_DEBUGGING.md):

Tests should support multiple valid implementation patterns

The implementation created app/products/[id]/ (a realistic nested route structure), but tests expected app/[id]/. By making tests
recursively search, we now accept both patterns - similar to the fix for eval 011 and 012.

## [5]:

Summary: Eval 015-server-actions-exports Fix

Issue:

Ambiguous prompt location:

- Prompt: "Create a simple server action in a file called action.ts"
- Codex created: action.ts (root level)
- Test expected: app/action.ts

Both locations are valid in Next.js - server actions can be defined anywhere and imported where needed.

---

Solution:

Added a helper function to check both locations:

function getActionPath(): string | null {
const appPath = join(process.cwd(), 'app', 'action.ts');
const rootPath = join(process.cwd(), 'action.ts');

    if (existsSync(appPath)) return appPath;
    if (existsSync(rootPath)) return rootPath;
    return null;

}

All three tests now use this helper instead of hardcoding app/action.ts:

// Before (brittle):
const actionsPath = join(process.cwd(), 'app', 'action.ts');
expect(existsSync(actionsPath)).toBe(true);

// After (flexible):
const actionsPath = getActionPath();
expect(actionsPath).not.toBeNull();

---

Pattern Applied:

Following EVAL_DEBUGGING.md principles, tests now accept multiple valid patterns:

- ✅ app/action.ts (typical Next.js convention)
- ✅ action.ts (root level, also valid)

This makes tests robust while still validating the core requirement: a properly structured server action file exists.

## [6]:

Summary: Eval 016-client-cookies Fix

**Status**: ❌ Build failed, tests failed (incomplete implementation + brittle tests)

**Problem**:

Prompt said: "Write a client component which calls a server action to set cookies on click. Be concise and only output the client component file, **assume the others exist**."

Codex created:

- `SetCookieButton.tsx` - client component that imports from './actions'
- `page.tsx` - basic server component (no button, no imports)

Missing:

- `app/actions.ts` - the server action file that SetCookieButton tried to import
- SetCookieButton was never imported or used in page.tsx

Tests only checked `page.tsx` directly, but the actual functionality was in the separate component file.

**Solution**:

**Implementation fixes:**

1. Created `app/actions.ts` with proper `setCookies()` server action using Next.js 15 API (`await cookies()`)
2. Updated `page.tsx` to add 'use client' directive and import/render `SetCookieButton`

**Test fixes** (similar to eval 011):
Added helper functions to recursively check imported components and actions files:

```typescript
// Helper to read file with all its imports
function readFileWithImports(
  filePath: string,
  visited = new Set<string>()
): string {
  // Recursively follows imports and combines content
}

// Helper to find actions files anywhere in app/
function findActionsFiles(): string {
  // Searches for actions.ts/action.ts files
}
```

Updated all tests to check combined content:

```typescript
// Before (brittle):
const pageContent = readFileSync("app/page.tsx", "utf-8");
expect(pageContent).toMatch(/['"]use client['"];?/);

// After (flexible):
const pageContent = readFileWithImports("app/page.tsx");
const actionsContent = findActionsFiles();
const allContent = pageContent + "\n" + actionsContent;
expect(allContent).toMatch(/['"]use client['"];?/);
```

**Results:**

- ✅ Build succeeds
- ✅ No ESLint errors
- ✅ All 4 tests pass

**Pattern Applied:**

This eval required **both** implementation fixes (missing files) and test improvements (brittle checks). Unlike evals 011-013, 015 where only tests needed updating, this prompt's "assume the others exist" instruction created genuinely incomplete code that couldn't build. Tests now support both inline and extracted component patterns per EVAL_DEBUGGING.md principles.

## [7]:

Summary: Eval 017-use-search-params Fix

**Status**: ❌ Tests failed (no implementation created)

**Problem**:

Prompt said: "Show a single file example of useSearchParams being correctly used with Suspense. **Only output the component code using useSearchParams and nothing else.**"

Codex created:

- Nothing - left the default `page.tsx` with basic server component

The prompt was ambiguous about what to do with "only output the component code" - Codex didn't create any implementation at all.

**Solution**:

**Implementation fix:**
Created a complete `page.tsx` with:

1. `'use client'` directive (required for useSearchParams)
2. `useSearchParams()` hook to read URL query parameters
3. `Suspense` wrapper with fallback UI
4. Inner component that uses the hook

```typescript
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SearchParamsComponent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("query");
  const filter = searchParams.get("filter");

  return (
    <div>
      <h1>Search Params Example</h1>
      <div>
        <p>Query: {query || "None"}</p>
        <p>Filter: {filter || "None"}</p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading search params...</div>}>
      <SearchParamsComponent />
    </Suspense>
  );
}
```

**Test status:**
✅ Tests were already well-designed! They supported both inline (everything in page.tsx) and extracted (separate component files) patterns. No test changes needed.

**Results:**

- ✅ Build succeeds
- ✅ No ESLint errors
- ✅ All 3 tests pass

**Key Insight:**

Unlike evals 011, 016 where tests needed updating, this eval's tests were already flexible. The issue was purely missing implementation due to ambiguous prompt wording. The tests properly checked for:

- useSearchParams usage in page.tsx OR imported components
- 'use client' directive in the component that uses the hook
- Suspense wrapper around the component

This shows good test design that supports multiple valid patterns from the start.

## [8]:

Summary: Eval 019-use-action-state Fix

**Status**: ❌ Build failed (inline server action in client component)

**Problem**:

Codex created a valid implementation using `useActionState`, but violated a Next.js rule:

**Build Error:**

```
It is not allowed to define inline "use server" annotated Server Actions in Client Components.
```

The code had:

```typescript
'use client';  // At top of file

async function saveContact(...) {
  'use server';  // ❌ Not allowed inside client component
  // ... server action code
}
```

This is a fundamental Next.js architecture rule - server actions must be in separate files when used by client components.

**Solution**:

**1. Created `app/actions.ts`:**

```typescript
"use server";

export async function saveContact(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // ... validation and processing logic
  return { status: "success", message: `Saved contact for ${name}.` };
}
```

**2. Updated `app/page.tsx`:**

```typescript
"use client";

import { useActionState } from "react";
import { saveContact } from "./actions"; // ✅ Import from separate file

// ... rest of component
```

**Tests:**
✅ Tests were already passing before the fix (they don't catch build errors, only runtime behavior)

**Results:**

- ✅ Build succeeds
- ✅ Lint passes
- ✅ All 6 tests pass

**Key Insight:**

This is a **framework constraint**, not a test brittleness issue. Next.js enforces separation of client and server code for security and architecture reasons. The fix is straightforward but essential - server actions used by client components must live in separate files with `'use server'` at the top.

The original implementation showed correct understanding of `useActionState` API, form handling, and state management - it just needed proper file organization per Next.js rules.
