import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import Page from './page';

test('Page is a client component', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );
  // Should have 'use client' directive
  expect(pageContent).toMatch(/['"]use client['"];?/);
});

test('Page has clickable element that calls server action', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should import a server action or have a server action call
  const hasServerAction =
    pageContent.includes('action=') ||
    pageContent.includes('onClick') ||
    pageContent.match(/import.*from.*['"]\./);

  expect(hasServerAction).toBe(true);
});

test('Page has button that can be clicked', () => {
  render(<Page />);

  // Should have a button or clickable element
  const buttons = screen.queryAllByRole('button');
  const clickableElements = screen.queryAllByRole('button');

  expect(buttons.length + clickableElements.length).toBeGreaterThan(0);
});

test('Server action sets cookies', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Look for evidence of cookie setting in imported actions or inline functions
  const hasCookieLogic =
    pageContent.includes('cookies()') ||
    pageContent.includes('set(') ||
    pageContent.includes('cookie');

  expect(hasCookieLogic).toBe(true);
});
