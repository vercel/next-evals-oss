import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('Page has server action implementation', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should have server action with 'use server' directive
  expect(pageContent).toMatch(/['"]use server['"];?/);

  // Should have an async function for server action
  expect(pageContent).toMatch(/async\s+function/);

  // Should handle FormData
  expect(pageContent).toMatch(/FormData|formData/);
});

test('Page has form component', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Should have a form element
  expect(pageContent).toMatch(/<form/);

  // Should have form action
  expect(pageContent).toMatch(/action.*=/);

  // Should have input elements
  expect(pageContent).toMatch(/<input/);

  // Should have submit button
  expect(pageContent).toMatch(/type.*=.*['"]submit['"]|<button.*type.*submit/);
});

test('Form uses server action properly', () => {
  const pageContent = readFileSync(
    join(process.cwd(), 'app', 'page.tsx'),
    'utf-8'
  );

  // Form action should reference the server action function
  expect(pageContent).toMatch(/action.*=.*\{.*\}|action.*=.*[a-zA-Z]/);

  // Should not use onClick handlers for form submission (server actions preferred)
  expect(pageContent).not.toMatch(/onClick.*submit|onClick.*preventDefault/);
});
