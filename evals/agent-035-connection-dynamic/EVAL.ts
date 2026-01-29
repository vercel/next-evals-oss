/**
 * connection() for Dynamic Rendering
 *
 * Tests whether the agent uses connection() from next/server to force dynamic
 * rendering instead of the deprecated unstable_noStore().
 *
 * Tricky because agents use unstable_noStore(), force-dynamic segment config,
 * or unrelated Dynamic APIs instead of the stable connection() function.
 */

import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Component imports connection from next/server', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // Should import connection from next/server
    expect(content).toMatch(/import.*connection.*from\s+['"]next\/server['"]/);
  }
});

test('Component uses await connection()', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // connection() returns a Promise and must be awaited
    expect(content).toMatch(/await\s+connection\s*\(\s*\)/);
  }
});

test('Component is async', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // Component must be async to use await
    expect(content).toMatch(/async\s+function|export\s+default\s+async/);
  }
});

test('Component uses Date for timestamp', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // Should use Date for generating timestamp
    expect(content).toMatch(/new\s+Date\s*\(|Date\.now\s*\(/);
  }
});

test('Does NOT use unstable_noStore (deprecated)', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // Should NOT use deprecated unstable_noStore
    expect(content).not.toMatch(/unstable_noStore/);
  }
});

test('Does NOT use force-dynamic segment config as primary approach', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // Should use connection() as the primary approach instead of segment config
    const hasForceDynamic = content.includes("dynamic = 'force-dynamic'") || content.includes('dynamic = "force-dynamic"');
    const hasConnection = /connection\s*\(\s*\)/.test(content);

    // Enforce that connection() is the primary dynamic approach
    // If force-dynamic is used, it cannot be the only dynamic mechanism
    // When connection() is available/used, force-dynamic should not be redundantly added
    if (hasForceDynamic && !hasConnection) {
      // force-dynamic is being used as the sole dynamic mechanism (wrong)
      expect.fail('force-dynamic segment config should not be the primary approach - use connection() instead');
    }
  }
});
