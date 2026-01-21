import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import Page from './page';

test('renders contact form component', () => {
  render(<Page />);
  expect(screen.getByText('Contact Us')).toBeDefined();
});

test('uses server action instead of client-side submission', () => {
  const content = readFileSync(join(process.cwd(), 'app', 'ContactForm.tsx'), 'utf-8');
  
  expect(content).not.toMatch(/['"]use client['"];?/);
  expect(content).not.toMatch(/onSubmit|fetch\s*\(|useState|preventDefault/);
  expect(content).toMatch(/['"]use server['"];?/);
  expect(content).toMatch(/async\s+function\s+\w+.*FormData/);
});

test('processes form data using FormData API', () => {
  const content = readFileSync(join(process.cwd(), 'app', 'ContactForm.tsx'), 'utf-8');
  
  expect(content).toMatch(/formData\.get\s*\(\s*['"]name['"]\s*\)/);
  expect(content).toMatch(/formData\.get\s*\(\s*['"]email['"]\s*\)/);
  expect(content).toMatch(/formData\.get\s*\(\s*['"]message['"]\s*\)/);
});

test('has proper form structure with action attribute', () => {
  const content = readFileSync(join(process.cwd(), 'app', 'ContactForm.tsx'), 'utf-8');
  
  expect(content).toMatch(/<form[^>]*action\s*=\s*{[^}]+}/);
  expect(content).toMatch(/name\s*=\s*['"]name['"]/);
  expect(content).toMatch(/name\s*=\s*['"]email['"]/);
  expect(content).toMatch(/name\s*=\s*['"]message['"]/);
  expect(content).toMatch(/type\s*=\s*['"]submit['"]/);
});

test('includes form validation', () => {
  const content = readFileSync(join(process.cwd(), 'app', 'ContactForm.tsx'), 'utf-8');
  
  expect(content).toMatch(/!name\s*\|\|\s*!email\s*\|\|\s*!message|if\s*\([^)]*(!name|!email|!message)/);
});

test('does not use API routes pattern', () => {
  const content = readFileSync(join(process.cwd(), 'app', 'ContactForm.tsx'), 'utf-8');
  
  expect(content).not.toMatch(/\/api\/\w+|JSON\.stringify|response\.json\(\)/);
});
