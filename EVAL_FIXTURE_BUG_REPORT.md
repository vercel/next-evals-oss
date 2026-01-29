# Bug Report: Three Eval Fixtures Have Test Infrastructure Issues

## Summary

Three eval fixtures in the `next-evals-oss` repository have test infrastructure bugs that prevent them from running successfully. These fixtures attempt to use React Testing Library to render components, but are missing critical dependencies and have a fundamental incompatibility with how Vitest handles JSX in `.ts` files.

## Affected Evals

- `agent-022-prefer-server-actions`
- `agent-024-avoid-redundant-usestate`
- `agent-025-prefer-next-link`

**Impact:** These 3 evals fail 100% of the time due to test setup issues, not agent capability issues.

## Root Causes

### 1. Missing Dependencies

The affected fixtures' `package.json` files were missing:
- `@testing-library/react` (required by EVAL.ts imports)
- `jsdom` (required by vitest for DOM environment)
- `@testing-library/dom` (peer dependency)

**Error observed:**
```
npm error peer react@"^18.0.0" from @testing-library/react@14.3.1
npm error Could not resolve dependency
```

### 2. TypeScript Configuration Issue

`tsconfig.json` includes `EVAL.ts` in the Next.js build compilation, causing build failures:

```json
"include": [
  "**/*.ts",  // This includes EVAL.ts
]
```

**Error observed:**
```
Failed to compile.
./EVAL.ts:12:32
Type error: Cannot find module '@testing-library/react'
```

### 3. Fundamental JSX Transformation Issue

**The core problem:** These evals use `.ts` extension for files containing JSX syntax. Vitest uses esbuild to transform TypeScript files, and esbuild does not process JSX in `.ts` files—only in `.tsx` files. The `@vitejs/plugin-react` plugin never gets a chance to transform the JSX because esbuild fails first.

**Error observed:**
```
Error: Transform failed with 1 error:
/vercel/sandbox/EVAL.ts:18:15: ERROR: Expected ">" but found "/"
  Plugin: vite:esbuild

  render(<Page />);
         ^
```

This is not configurable—it's a fundamental limitation of how Vitest/Vite/esbuild work together.

## Why These 3 Evals Are Different

**17/20 evals work correctly** because they use file-based assertions:
```typescript
// Working pattern (agent-021, agent-023, etc.)
test('checks file content', () => {
  const content = readFileSync('app/page.tsx', 'utf-8');
  expect(content).toMatch(/async function/);
});
```

**3/20 evals fail** because they attempt component rendering:
```typescript
// Broken pattern (agent-022, agent-024, agent-025)
import { render, screen } from '@testing-library/react';
import Page from './page';  // Imports JSX component

test('renders component', () => {
  render(<Page />);  // JSX in .ts file - fails
});
```

## Attempted Solutions

We attempted multiple vitest.config.ts configurations:
1. ✗ Explicit `jsx: 'automatic'` in esbuild config
2. ✗ Setting `loader: 'tsx'` for .ts files
3. ✗ Configuring `@vitejs/plugin-react` to include .ts files
4. ✗ Using `optimizeDeps.esbuildOptions.loader`

None successfully override esbuild's default behavior for `.ts` files.

## Recommended Solutions

### Option 1: Rename EVAL.ts → EVAL.tsx (Recommended)

The simplest fix is to use the correct file extension for files containing JSX.

**Required changes:**
- Rename `EVAL.ts` to `EVAL.tsx` in the 3 affected fixtures
- Update the agent-eval framework to look for either `EVAL.ts` or `EVAL.tsx`
- Update `tsconfig.json` to exclude `EVAL.tsx`:
  ```json
  "exclude": ["node_modules", "EVAL.tsx"]
  ```

**Pros:** Follows TypeScript/Vitest conventions, minimal changes
**Cons:** Requires framework change to support both extensions

### Option 2: Rewrite Tests to Use File-Based Assertions

Convert these 3 evals to match the pattern used by the other 17 evals—check file contents instead of rendering components.

**Example conversion:**
```typescript
// Instead of:
import { render, screen } from '@testing-library/react';
import Page from './page';
test('renders contact form', () => {
  render(<Page />);
  expect(screen.getByText('Contact Us')).toBeDefined();
});

// Use:
import { readFileSync } from 'fs';
import { join } from 'path';
test('renders contact form', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  const contactFormContent = readFileSync(join(process.cwd(), 'app', 'ContactForm.tsx'), 'utf-8');

  // Check that ContactForm is imported and used
  expect(pageContent).toMatch(/import.*ContactForm/);
  expect(pageContent).toMatch(/<ContactForm/);

  // Check ContactForm structure
  expect(contactFormContent).toMatch(/Contact Us/);
});
```

**Pros:** Consistent with other evals, no framework changes needed
**Cons:** Potentially less thorough testing, requires rewriting test logic

### Option 3: Add Missing Dependencies Only

If the JSX transformation issue is acceptable as a known limitation:

Add to `package.json` for all 3 fixtures:
```json
"devDependencies": {
  "@testing-library/react": "^16.1.0",
  "@testing-library/dom": "^10.4.1",
  "jsdom": "^27.4.0",
  // ... existing deps
}
```

Add to `tsconfig.json`:
```json
"exclude": ["node_modules", "EVAL.ts"]
```

**Pros:** Fixes dependency issues
**Cons:** JSX transformation issue remains unresolved

## Evidence

Pattern analysis across all evals:
```bash
$ grep -l "@testing-library/react" evals/*/EVAL.ts
evals/agent-022-prefer-server-actions/EVAL.ts
evals/agent-024-avoid-redundant-usestate/EVAL.ts
evals/agent-025-prefer-next-link/EVAL.ts

# Only these 3 evals attempt component rendering
# All 3 are currently failing due to infrastructure issues
```

## Conclusion

These 3 eval fixtures have fundamental test infrastructure issues that prevent meaningful evaluation of agent capabilities. The failures are 100% infrastructure-related, not agent-related.

**Immediate recommendation:** Use Option 1 (rename to .tsx) as it requires minimal changes and follows established TypeScript conventions for JSX files.

## Appendix: Full List of Required Changes

If pursuing Option 1:

**For each affected eval:**

1. **package.json** - Add dependencies:
```json
"devDependencies": {
  "@testing-library/react": "^16.1.0",
  "@testing-library/dom": "^10.4.1",
  "jsdom": "^27.4.0"
}
```

2. **Rename:** `EVAL.ts` → `EVAL.tsx`

3. **tsconfig.json** - Exclude test file:
```json
"exclude": ["node_modules", "EVAL.tsx"]
```

4. **vitest.config.ts** - Create config:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['EVAL.tsx'],
  },
});
```

5. **agent-eval framework** - Update to support both extensions when looking for eval test files.

---

*Report generated during investigation of pass rate discrepancies between baseline and CLAUDE.md experiments.*
