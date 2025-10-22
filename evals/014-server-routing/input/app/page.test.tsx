import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import Page from './page';

test('Page is a server component', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );
  // Should NOT have 'use client' directive
  expect(pageContent).not.toMatch(/['"]use client['"];?/);
});

test('Page implements server-side routing patterns', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should NOT use client-side routing hooks
  expect(pageContent).not.toMatch(/useRouter|usePathname/);

  // Should use appropriate server patterns
  const hasServerNavigation =
    pageContent.includes('next/link') ||
    pageContent.includes('redirect(') ||
    pageContent.includes('permanentRedirect(') ||
    pageContent.includes('next/navigation') ||
    pageContent.match(/href=["'][^"']*["']/);

  expect(hasServerNavigation).toBe(true);
});

test('Page does not mix server and client routing', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // If it's a server component, it should not use client-side routing
  if (!pageContent.includes("'use client'")) {
    expect(pageContent).not.toMatch(
      /useRouter|usePathname|router\.push|router\.replace/
    );
  }
});

test('Page has navigation link or redirect functionality', () => {
  render(<Page />);

  // Should have either a link or some form of navigation
  const links = screen.queryAllByRole('link');
  const buttons = screen.queryAllByRole('button');

  // At least one navigation element should exist
  expect(links.length + buttons.length).toBeGreaterThan(0);
});
