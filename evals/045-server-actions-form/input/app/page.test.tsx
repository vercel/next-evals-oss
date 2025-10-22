import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('Server action function exists', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have submitForm function
  expect(content).toMatch(/function\s+submitForm|const\s+submitForm\s*=/);
  
  // Should be async
  expect(content).toMatch(/async\s+function\s+submitForm|async\s*\(/);
  
  // Should have 'use server' directive
  expect(content).toMatch(/['"]use server['"]/);
});

test('Server action handles FormData', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should accept FormData parameter
  expect(content).toMatch(/formData|FormData/);
  
  // Should get 'name' field
  expect(content).toMatch(/formData\.get\(['"]name['"]\)/);
  
  // Should log the value
  expect(content).toMatch(/console\.log/);
});

test('Form uses server action', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have form element
  expect(content).toMatch(/<form/);
  
  // Should use action prop with submitForm
  expect(content).toMatch(/action=\{submitForm\}/);
  
  // Should NOT use onSubmit
  expect(content).not.toMatch(/onSubmit/);
});

test('Form has correct input and button', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have input with name="name"
  expect(content).toMatch(/<input[^>]*name=["']name["']/);
  
  // Should have placeholder
  expect(content).toMatch(/placeholder=["']Enter your name["']/);
  
  // Should have submit button
  expect(content).toMatch(/<button[^>]*>.*Submit.*<\/button>/);
});
