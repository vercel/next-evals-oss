import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import Page from './page';

vi.mock('next/navigation', () => {
  const actual = vi.importActual('next/navigation');
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      push: vi.fn(),
    })),
    useSearchParams: vi.fn(() => ({
      get: vi.fn(),
    })),
    usePathname: vi.fn(),
  };
});

test('Page renders correctly', () => {
  render(<Page />);
  expect(screen.getByRole('button', { name: 'Navigate' })).toBeDefined();
});

test('Page is a client component', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );
  // Should have 'use client' directive since useRouter requires client component
  expect(pageContent).toMatch(/['"]use client['"];?/);
});

test('Page imports and uses useRouter hook', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should import useRouter from next/navigation
  expect(pageContent).toMatch(
    /import.*useRouter.*from ['"]next\/navigation['"]/
  );

  // Should call useRouter hook
  expect(pageContent).toMatch(/useRouter\s*\(\s*\)/);
});

test('Page uses router functionality', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should use router methods like push, replace, back, forward, refresh
  const usesRouterMethods =
    pageContent.includes('.push(') ||
    pageContent.includes('.replace(') ||
    pageContent.includes('.back(') ||
    pageContent.includes('.forward(') ||
    pageContent.includes('.refresh(');

  expect(usesRouterMethods).toBe(true);
});

test('Page does not use Pages Router API', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should NOT import from next/router (Pages Router)
  expect(pageContent).not.toMatch(/from ['"]next\/router['"]/);

  // Should NOT use Pages Router patterns
  expect(pageContent).not.toMatch(
    /router\.pathname|router\.query|router\.asPath/
  );
});
