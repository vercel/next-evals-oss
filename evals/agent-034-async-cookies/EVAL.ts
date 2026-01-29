/**
 * Async Cookies/Headers
 *
 * Tests whether the agent awaits cookies() and headers() calls, which became
 * async in Next.js 16 (breaking change from synchronous access in Next.js 15).
 *
 * Tricky because agents trained on Next.js 15 call cookies()/headers()
 * synchronously — Next.js 16 removed synchronous access entirely.
 */

import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Component uses await with cookies()', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // In Next.js 16, cookies() returns a Promise and MUST be awaited
    // Correct: const cookieStore = await cookies()
    // Wrong: const cookieStore = cookies()
    expect(content).toMatch(/await\s+cookies\s*\(\s*\)/);
  }
});

test('Component uses await with headers()', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // In Next.js 16, headers() returns a Promise and MUST be awaited
    // Correct: const headersList = await headers()
    // Wrong: const headersList = headers()
    expect(content).toMatch(/await\s+headers\s*\(\s*\)/);
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

test('Component reads theme cookie', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // Should read "theme" cookie
    expect(content).toMatch(/['"]theme['"]/);

    // Should use .get() method on cookie store
    expect(content).toMatch(/\.get\s*\(/);
  }
});

test('Component reads Accept-Language header', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // Should read Accept-Language header
    expect(content).toMatch(/accept-language/i);
  }
});

test('Does NOT use synchronous cookies() pattern', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  if (existsSync(pagePath)) {
    const content = readFileSync(pagePath, 'utf-8');

    // Should NOT have synchronous pattern like:
    // const cookieStore = cookies()
    // (without await)

    // This regex matches "cookies()" that is NOT preceded by "await"
    // We check that every cookies() call is preceded by await
    const syncCookiesPattern = /(?<!await\s)cookies\s*\(\s*\)(?!\s*\.then)/;

    // Verify the synchronous cookies() pattern is NOT used
    expect(content).not.toMatch(syncCookiesPattern);
  }
});
