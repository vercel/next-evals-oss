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
  // Should have 'use client' directive since useActionState requires client component
  expect(pageContent).toMatch(/['"]use client['"];?/);
});

test('Page imports and uses useActionState', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should import useActionState
  expect(pageContent).toMatch(/import.*useActionState.*from ['"]react['"]/);

  // Should call useActionState hook
  expect(pageContent).toMatch(/useActionState\s*\(/);
});

test('Page does not import or use useFormState', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should NOT import useFormState
  expect(pageContent).not.toMatch(/import.*useFormState.*from/);

  // Should NOT call useFormState hook
  expect(pageContent).not.toMatch(/useFormState\s*\(/);
});

test('Page does not use useState', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should NOT use useState as per prompt requirement
  expect(pageContent).not.toMatch(/useState/);
});

test('Page has form with server action', () => {
  render(<Page />);

  // Should have a form element
  const forms = screen.queryAllByRole('form');
  const formElements = screen.queryAllByText(/form/i);

  expect(forms.length > 0 || formElements.length > 0).toBe(true);
});

test('Page uses useActionState with server action properly', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should have form action connected to useActionState
  const hasActionStateIntegration =
    pageContent.includes('formAction') ||
    (pageContent.includes('useActionState') && pageContent.includes('action='));

  expect(hasActionStateIntegration).toBe(true);
});
