# Next.js Evals

This directory contains evaluation test cases for testing LLM code generation capabilities with Next.js.

## Eval Structure

Each eval follows this structure:

```
evals/
  XXX-eval-name/
    prompt.md          # Goal-oriented task description
    input/
      app/
        page.tsx       # Starting code (may be empty or scaffold)
        page.e2e.ts    # Playwright E2E tests for behavior
        page.spec.md   # Criteria for LLM judge evaluation
      layout.tsx
      package.json
      playwright.config.ts
```

## Writing Good Evals

### 1. Goal-Oriented Prompts (`prompt.md`)

Describe **what** the user wants, not **how** to implement it:

```markdown
# Good - Goal-oriented
Create a click counter page. The page should display "Count: 0" initially
and have an "Increment" button that increases the count by 1 each time it's clicked.

# Bad - Prescriptive
Create a client component with 'use client' directive. Use useState hook
to manage count state initialized to 0. Add a button with onClick handler...
```

### 2. E2E Tests (`page.e2e.ts`)

Test observable behavior, not implementation details:

```typescript
import { test, expect } from '@playwright/test';

test('counter increments on click', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Count: 0')).toBeVisible();
  await page.click('button');
  await expect(page.locator('text=Count: 1')).toBeVisible();
});
```

### 3. Spec Files (`page.spec.md`)

Natural language criteria for the LLM judge to evaluate code quality:

```markdown
# Evaluation Criteria

This component should be a client-side React counter.

## Requirements

1. Uses 'use client' directive - required for client-side interactivity
2. Uses React useState hook to manage the count state, initialized to 0
3. Displays the current count in the format "Count: X"
4. Has a button labeled "Increment" that increases the count by 1
5. The component should be the default export
```

## Evaluation Flow

1. **Agent generates code** based on `prompt.md`
2. **Build** - `next build` must succeed
3. **Lint** - ESLint must pass
4. **E2E Tests** - Playwright tests verify behavior
5. **LLM Judge** - Evaluates code against `page.spec.md` criteria

## File Visibility

| File | Visible to Agent | Used For |
|------|-----------------|----------|
| `prompt.md` | Yes | Task description |
| `page.tsx` | Yes | Starting code |
| `page.e2e.ts` | No | Behavior testing |
| `page.spec.md` | No | Judge evaluation |
| `playwright.config.ts` | No | Test configuration |
