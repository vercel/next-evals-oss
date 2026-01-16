import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import Page from './page';

test('App has a client component with use client directive', () => {
  const appDir = join(process.cwd(), 'app');

  // Check all .tsx files in app directory for 'use client' directive
  // The model may create a separate client component file (valid pattern)
  const tsxFiles = readdirSync(appDir).filter(f => f.endsWith('.tsx'));

  const hasClientDirective = tsxFiles.some(file => {
    const content = readFileSync(join(appDir, file), 'utf-8');
    return /['"]use client['"];?/.test(content);
  });

  expect(hasClientDirective).toBe(true);
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
  const appDir = join(process.cwd(), 'app');

  // Check all .ts and .tsx files for cookie logic
  // The model may put server actions in a separate file (e.g., actions.ts)
  const codeFiles = readdirSync(appDir).filter(
    f => f.endsWith('.ts') || f.endsWith('.tsx')
  );

  const hasCookieLogic = codeFiles.some(file => {
    const content = readFileSync(join(appDir, file), 'utf-8');
    return (
      content.includes('cookies()') ||
      content.includes('cookies(') ||
      content.includes('.set(') ||
      content.includes('cookie')
    );
  });

  expect(hasCookieLogic).toBe(true);
});
