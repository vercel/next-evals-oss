import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Keep the pinned 26-eval set while backporting assertion fixes. Fail closed
// when upstream changes either block so a sync cannot silently undo the fixes.
const oldLayout = `  // Should accept children prop with ReactNode type
  expect(layoutContent).toMatch(/children.*ReactNode/)`;
const fixedLayout = `  // Accept both documented root-layout typing forms (next.js#98365).
  const layoutCode = stripComments(layoutContent)
  expect(layoutCode).toMatch(/children/)
  expect(layoutCode).toMatch(/(?:React\\.)?ReactNode|LayoutProps\\s*</)`;
const auroraLayout = `  // Should accept children using either an inline ReactNode type or the
  // globally available LayoutProps helper.
  const layoutCode = stripComments(layoutContent)
  expect(layoutCode).toMatch(/children/)
  expect(layoutCode).toMatch(/(?:React\\.)?ReactNode|LayoutProps\\s*</)`;
const oldError = `  // Should accept error props
  expect(errorContent).toMatch(/error.*Error|Error.*error/)`;
const fixedError = `  // Follow the exported component instead of requiring its implementation
  // and Error annotation to appear literally in app/error.tsx.
  await expect(environment).toSatisfyCriterion(
    \`app/error.tsx exports a working App Router error boundary Client Component.
Follow its default export, including local imports, re-exports, and wrapper
components. The exported component must accept Next.js's error and reset props,
render an error fallback, and provide a retry action that calls reset. An inline
implementation, a re-export of a shared component, and a wrapper forwarding the
props are equally valid. Type annotations can be inline or imported.

Reject a missing or unresolved export, a non-component export, a wrapper that
drops the error/reset props, or a fallback whose retry action never calls reset.
Judge the actual implementation, not filenames, comments, or type names.\`
  )`;
const syncErrorTest = `test('Error handling migrated to error.js and not-found.js', () => {`;
const asyncErrorTest = `test('Error handling migrated to error.js and not-found.js', async () => {`;

function replaceKnown(source, old, fixed, label) {
  if (source.includes(fixed)) return source;
  if (source.split(old).length !== 2) {
    throw new Error(`agent-030: unexpected upstream ${label}; review the assertion patch before syncing`);
  }
  return source.replace(old, fixed);
}

export function patchAgent030(source) {
  let patched = source.includes(auroraLayout)
    ? source.replace(auroraLayout, fixedLayout)
    : replaceKnown(source, oldLayout, fixedLayout, 'root-layout assertion');
  patched = replaceKnown(patched, syncErrorTest, asyncErrorTest, 'error test');
  return replaceKnown(patched, oldError, fixedError, 'error-props assertion');
}

export function patchAgent030File(evalsDir) {
  const path = join(evalsDir, 'agent-030-app-router-migration-hard', 'EVAL.ts');
  const source = readFileSync(path, 'utf8');
  const patched = patchAgent030(source);
  if (source !== patched) writeFileSync(path, patched);
}
