import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { patchAgent030, patchAgent030File } from './patch-agent-030.mjs';

const upstream = readFileSync(new URL('./fixtures/agent-030-layout-fixed.txt', import.meta.url), 'utf8');
const auroraBlock = `  // Should accept children using either an inline ReactNode type or the
  // globally available LayoutProps helper.
  const layoutCode = stripComments(layoutContent)
  expect(layoutCode).toMatch(/children/)
  expect(layoutCode).toMatch(/(?:React\\.)?ReactNode|LayoutProps\\s*</)`;
const pinned = upstream.replace(auroraBlock, `  // Should accept children prop with ReactNode type
  expect(layoutContent).toMatch(/children.*ReactNode/)`);

test('the CI pin and Aurora fix converge on identical corrected fixtures', () => {
  assert.notEqual(pinned, upstream);
  assert.equal(patchAgent030(pinned), patchAgent030(upstream));
});

test('reapplying the correction is idempotent', () => {
  const fixed = patchAgent030(upstream);
  assert.equal(patchAgent030(fixed), fixed);
});

test('only layout typing and the error-props check change', () => {
  const fixed = patchAgent030(upstream);
  assert.equal((fixed.match(/test\('/g) ?? []).length, 8);
  const unaffected = source => source
    .replace(/  \/\/ (?:Should accept children using|Accept both documented)[\s\S]*?(?=\n}\))/, '')
    .replace(/test\('Error handling migrated[\s\S]*?(?=\ntest\('Client components)/, '');
  assert.equal(unaffected(fixed), unaffected(upstream));
  assert.ok(fixed.includes("expect(existsSync(errorPath)).toBe(true)"));
  assert.ok(fixed.includes("expect(existsSync(notFoundPath)).toBe(true)"));
  assert.ok(fixed.includes('expect(errorContent).toMatch'));
  assert.ok(!fixed.includes('/error.*Error|Error.*error/'));
});

test('unexpected upstream assertions fail closed', () => {
  assert.throws(() => patchAgent030(upstream.replace('/error.*Error|Error.*error/', '/different/')), /unexpected upstream/);
  assert.throws(() => patchAgent030(upstream.replace('LayoutProps\\s*<', 'DifferentProps')), /unexpected upstream/);
});

test('failed validation does not modify the file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-030-'));
  try {
    const evalDir = join(dir, 'agent-030-app-router-migration-hard');
    mkdirSync(evalDir);
    const path = join(evalDir, 'EVAL.ts');
    const invalid = upstream.replace('/error.*Error|Error.*error/', '/different/');
    writeFileSync(path, invalid);
    assert.throws(() => patchAgent030File(dir), /unexpected upstream/);
    assert.equal(readFileSync(path, 'utf8'), invalid);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
