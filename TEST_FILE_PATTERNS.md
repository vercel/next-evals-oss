# Test File Pattern Analysis

## Summary
All test files in evals follow the pattern `solution/[test_file_path]` → `input/[test_file_path]`

## Standard Pattern (46+ evals)
**Pattern**: `solution/app/page.test.tsx` → `input/app/page.test.tsx`

Used by evals: 001-046 (except 000, 047, 048), and 049

## Exceptions (3 evals)

### 000-app-router-migration-simple
- **Pattern**: `solution/migration.test.tsx` → `input/migration.test.tsx`
- **Reason**: Root-level migration test, not page-specific

### 047-middleware
- **Pattern**: `solution/middleware.test.tsx` → `input/middleware.test.tsx`
- **Reason**: Tests middleware configuration at root level

### 048-draft-mode
- **Pattern**: `solution/app/draft.test.tsx` → `input/app/draft.test.tsx`
- **Reason**: Tests draft mode functionality, not standard page

## Verification

All test files are located in:
- `solution/` folders (source)
- `input/` folders (destination)

The copy script handles all three exception cases automatically.
