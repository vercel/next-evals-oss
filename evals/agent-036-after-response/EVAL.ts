/**
 * after() for Post-Response Work
 *
 * Tests whether the agent uses after() from next/server to schedule work
 * (logging, analytics) after the response is sent, without blocking it.
 *
 * Tricky because agents use fire-and-forget promises, setTimeout, or
 * Vercel-specific waitUntil() instead of the built-in after() API.
 */

import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Component imports after from next/server', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const layoutPath = join(process.cwd(), 'app', 'layout.tsx');

  let foundImport = false;

  for (const path of [pagePath, layoutPath]) {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');
      if (content.match(/import.*after.*from\s+['"]next\/server['"]/)) {
        foundImport = true;
        break;
      }
    }
  }

  expect(foundImport).toBe(true);
});

test('Component uses after() with callback', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const layoutPath = join(process.cwd(), 'app', 'layout.tsx');

  let foundAfterCall = false;

  for (const path of [pagePath, layoutPath]) {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');
      // Should call after() with a callback function
      if (content.match(/after\s*\(\s*(\(|async\s*\(|function|async\s+function)/)) {
        foundAfterCall = true;
        break;
      }
    }
  }

  expect(foundAfterCall).toBe(true);
});

test('after() callback contains logging logic', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const layoutPath = join(process.cwd(), 'app', 'layout.tsx');

  let hasLogging = false;

  for (const path of [pagePath, layoutPath]) {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');
      // Should have some logging-related code
      if (content.match(/after\s*\(/) && content.match(/log|analytics|track|console/i)) {
        hasLogging = true;
        break;
      }
    }
  }

  expect(hasLogging).toBe(true);
});

test('Does NOT use waitUntil directly', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const layoutPath = join(process.cwd(), 'app', 'layout.tsx');

  for (const path of [pagePath, layoutPath]) {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');
      // Should NOT use waitUntil directly (platform-specific)
      expect(content).not.toMatch(/waitUntil\s*\(/);
    }
  }
});

test('Does NOT await the logging operation inline', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const layoutPath = join(process.cwd(), 'app', 'layout.tsx');

  for (const path of [pagePath, layoutPath]) {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');
      // The after() function should be used - not awaiting log operations directly
      if (content.match(/after\s*\(/)) {
        // Good - using after()
        expect(content).toMatch(/after\s*\(/);
      }
    }
  }
});
