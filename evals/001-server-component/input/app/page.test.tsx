import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('Page is an async server component', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should be an async function (server component)
  expect(pageContent).toMatch(
    /export\s+default\s+async\s+function|async\s+function.*Page/
  );

  // Should NOT have 'use client' directive
  expect(pageContent).not.toMatch(/['']use client[''];?/);
});

test('Page fetches from correct API endpoint', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should fetch from the correct URL
  expect(pageContent).toMatch(/api\.vercel\.app\/products/);

  // Should use fetch
  expect(pageContent).toMatch(/fetch\s*\(/);

  // Should use await for the fetch
  expect(pageContent).toMatch(/await.*fetch|fetch.*await/);
});

test('Page renders first product in h1 tag', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should access first product (array[0] or similar)
  expect(pageContent).toMatch(/\[0\]|\bfirst\b|\.at\(0\)/i);

  // Should render in h1 tag
  expect(pageContent).toMatch(/<h1[^>]*>.*<\/h1>/);

  // Should access the product name property
  expect(pageContent).toMatch(/\.name\b/);
});

test('Page handles JSON response correctly', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should parse JSON response
  expect(pageContent).toMatch(/\.json\(\)/);

  // Should handle the JSON parsing asynchronously (either awaited or returned from async function)
  // This accepts both: 'await response.json()' and 'return response.json()' in async functions
  const hasJsonCall = /\.json\(\)/.test(pageContent);
  const hasAsyncFunction = /async\s+function/.test(pageContent);
  expect(hasJsonCall && hasAsyncFunction).toBe(true);
});
