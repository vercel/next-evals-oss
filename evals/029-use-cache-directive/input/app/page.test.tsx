import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('Page has child component with use cache directive', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should render a child component
  expect(pageContent).toMatch(/<[A-Z][a-zA-Z]*\s*\/?>|<[A-Z][a-zA-Z]*[^>]*>/);

  // Should have 'use cache' directive somewhere in the file or child component
  expect(pageContent).toMatch(/['"]use cache['"];?/);
});

test('Component fetches data using getAllProducts from lib/db', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should import getAllProducts from lib/db
  expect(pageContent).toMatch(/import.*getAllProducts.*lib\/db|from.*lib\/db/);

  // Should call getAllProducts function
  expect(pageContent).toMatch(/getAllProducts\(\)|await.*getAllProducts/);
});

test('Component uses cache tag for products', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should use cacheTag() function with "products" tag
  expect(pageContent).toMatch(
    /cacheTag\(['"]products['"]\)|cacheTag\s*\(['"]products['"]\)/
  );
});

test('Page has server action for cache invalidation', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should have server action with 'use server' directive
  expect(pageContent).toMatch(/['"]use server['"];?/);

  // Should have an async function for server action
  expect(pageContent).toMatch(/async\s+function/);

  // Should invalidate cache using revalidateTag
  expect(pageContent).toMatch(/revalidateTag|revalidate.*tag/i);

  // Should invalidate the "products" tag
  expect(pageContent).toMatch(
    /revalidateTag.*['"]products['"]|['"]products['"].*revalidateTag/
  );
});

test('Page has form that calls server action', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should have a form element
  expect(pageContent).toMatch(/<form/);

  // Should have form action
  expect(pageContent).toMatch(/action.*=/);

  // Should have submit button
  expect(pageContent).toMatch(/type.*=.*['"]submit['"]|<button.*type.*submit/);
});
