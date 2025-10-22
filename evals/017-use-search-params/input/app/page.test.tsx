import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('Page uses useSearchParams with Suspense', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should be a client component
  expect(pageContent).toMatch(/['"]use client['"];?/);

  // Should import useSearchParams from next/navigation
  expect(pageContent).toMatch(
    /import.*useSearchParams.*from.*['"]next\/navigation['"];?/
  );

  // Should use Suspense boundary
  expect(pageContent).toMatch(/Suspense/);

  // Should call useSearchParams hook
  expect(pageContent).toMatch(/useSearchParams\(\)/);
});

test('Page properly wraps component with Suspense', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should have Suspense import
  expect(pageContent).toMatch(/import.*Suspense.*from.*['"]react['"];?/);

  // Should have fallback prop in Suspense
  expect(pageContent).toMatch(/fallback.*=/);

  // Component using useSearchParams should be wrapped in Suspense
  const hasSuspenseWrapper =
    pageContent.includes('<Suspense') &&
    pageContent.includes('useSearchParams');

  expect(hasSuspenseWrapper).toBe(true);
});
