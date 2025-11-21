# Eval Debugging Notes

---

## Overview

The Next.js eval system tests AI models' ability to generate correct Next.js code in a **single-shot** fashion. Models receive:

- Complete project files
- A prompt describing the task
- No runtime feedback (no build/lint/test errors during generation)

The evaluation pipeline:

1. Model generates all code changes
2. System applies changes to disk
3. System runs build, lint, and tests
4. Results are scored (pass/fail)

**Critical limitation**: Models cannot iterate on errors. They must produce working code on the first try based solely on their training knowledge and the provided context.

---

### Tests Too Narrow - Miss Best Practices

**Issue**: Tests often check for specific implementation patterns rather than correct functionality.

**Example (011-client-server-form)**:

Codex correctly separated concerns:

```
app/
  page.tsx           # Server component with layout
  contact-form.tsx   # Client component with form
  actions.ts         # Server actions
```

But tests expected everything in `page.tsx`:

```typescript
// Test looked for this in page.tsx:
expect(pageContent).toMatch(/['"]use server['"];?/);
expect(pageContent).toMatch(/<form/);
```

**Why this matters**: Modern Next.js best practices recommend separating client/server components, but tests penalized this good architecture.

**Solution**: Tests should recursively check imported components and actions files.

---

### Ambiguous Prompts Lead to Wrong Implementations

**Issue**: Prompts can be misleading or ambiguous about requirements.

**Example (008-generate-static-params)**:

Prompt said:

> "Do not include the page React component, only the generateStaticParams function."

But Next.js **requires** a default export in `page.tsx`. Model followed prompt literally:

```typescript
// page.tsx
export function generateStaticParams() {
  return [{ id: "1" }];
}
// ❌ Missing required default export
```

**Result**: Tests pass (only check for generateStaticParams), but build fails (requires default export).

**Solution**: Prompts should reflect actual framework requirements, not arbitrary constraints.

---

### 008: generateStaticParams

**Status**: ✅ Tests pass, ❌ Build fails

**Problem**:

- Prompt says "do not include the page React component"
- But Next.js requires default export in page.tsx
- Model followed prompt literally

**Current**:

```typescript
// page.tsx
export function generateStaticParams() {
  return [{ id: "1" }];
}
// Missing: export default function Page() { ... }
```

**Lesson**: Prompts must align with framework requirements. Tests should verify build success.

---

### 011: Client-Server Form

**Status**: ❌ Tests fail (but implementation correct!)

**Problem**:

- Model correctly extracted components following best practices:
  - `page.tsx` - server component
  - `contact-form.tsx` - client component
  - `actions.ts` - server actions
- Tests only checked `page.tsx` directly

**Solution**: Updated tests to recursively check imports and actions files.

#### Changes Made

**File**: `evals/011-client-server-form/input/app/page.test.tsx`

**What Changed**:

1. Added helper function `findImports()` to extract import statements from files
2. Added helper function `readFileWithImports()` to recursively read imported components
3. Added helper function `findFilesInApp()` to locate actions.ts files anywhere in app/
4. Updated all three tests to use combined content from page.tsx + imports + actions files

**Why**:

- **Old approach**: Only checked `page.tsx` for patterns like `'use server'`, `<form>`, etc.
- **Problem**: Codex correctly separated client/server components (best practice), but tests failed
- **New approach**: Tests now check the entire component tree and actions files
- **Result**: Tests pass for both inline (monolithic) and extracted (best practice) patterns

**Example**:

```typescript
// Before: Only checked page.tsx
const pageContent = readFileSync("app/page.tsx", "utf-8");
expect(pageContent).toMatch(/['"]use server['"];?/);

// After: Checks page.tsx + imports + actions files
const pageContent = readFileWithImports("app/page.tsx");
const actionsFiles = findFilesInApp(/actions?\.(ts|tsx)$/);
const allContent = pageContent + "\n" + actionsFiles.join("\n");
expect(allContent).toMatch(/['"]use server['"];?/);
```

This pattern should be applied to other evals that currently fail when models follow modern component separation patterns.

**Before**:

```typescript
test("Page has server action", () => {
  const pageContent = readFileSync("app/page.tsx", "utf-8");
  expect(pageContent).toMatch(/['"]use server['"];?/);
  // ❌ Fails when action is in actions.ts
});
```

**After**:

```typescript
test("Page has server action", () => {
  const allContent = readFileWithImports("app/page.tsx");
  const actionsFiles = findFilesInApp(/actions?\.(ts|tsx)$/);
  const combined = allContent + actionsFiles.join("\n");
  expect(combined).toMatch(/['"]use server['"];?/);
  // ✅ Checks all relevant files
});
```

**Lesson**: Tests should support both inline and extracted component patterns.

---

## Testing Best Practices

### 1. Support Multiple Valid Patterns

Modern Next.js apps can structure code in various ways. Tests should accept:

- ✅ Inline patterns (everything in one file)
- ✅ Extracted patterns (separated components)
- ✅ Different file organizations

**Implementation**:

```typescript
function readFileWithImports(filePath: string, visited = new Set()): string {
  if (!existsSync(filePath) || visited.has(filePath)) return "";

  visited.add(filePath);
  let content = readFileSync(filePath, "utf-8");

  // Recursively read imports
  const imports = findImports(filePath);
  for (const importPath of imports) {
    content += "\n" + readFileWithImports(resolveImport(importPath), visited);
  }

  return content;
}
```

### 2. Check Semantic Requirements, Not Syntax

Bad:

```typescript
// Too specific - assumes button text
expect(content).toMatch(/button.*>Submit</);
```

Good:

```typescript
// Checks for submit button existence
expect(content).toMatch(/type.*=.*['"]submit['"]|<button.*type.*submit/);
```

### 3. Search All Relevant Files

For server actions, check:

- `page.tsx` (inline actions)
- `actions.ts` / `action.ts` (extracted actions)
- Imported component files

```typescript
const actionsFiles = findFilesInApp(/actions?\.(ts|tsx)$/);
const allContent = pageContent + actionsFiles.join("\n");
```

### 4. Test Outcomes, Not Implementation

Focus on:

- ✅ Does it build?
- ✅ Does it pass lint?
- ✅ Does it function correctly?

Not:

- ❌ Is the button text exactly "Submit"?
- ❌ Is everything in one file?
- ❌ Does it use specific hook names?

---
