import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('Page imports and uses Suspense', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should import Suspense from React
  expect(content).toMatch(/import.*Suspense.*from\s+['"]react['"]/);
  
  // Should use Suspense component
  expect(content).toMatch(/<Suspense/);
  
  // Should have fallback prop
  expect(content).toMatch(/fallback=["'{]/);
});

test('Page has fast-loading header', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have h1 with Dashboard
  expect(content).toMatch(/<h1[^>]*>.*Dashboard.*<\/h1>/);
});

test('Slow component is async with delay', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have async component
  expect(content).toMatch(/async\s+function\s+\w*[Ss]low/);
  
  // Should have Promise with setTimeout
  expect(content).toMatch(/new\s+Promise.*setTimeout|setTimeout.*Promise/);
  
  // Should have 3000ms delay
  expect(content).toMatch(/3000/);
  
  // Should return Data loaded! message
  expect(content).toMatch(/Data loaded!/);
});

test('Suspense wraps slow component with fallback', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have fallback with Loading data...
  expect(content).toMatch(/fallback.*Loading data\.\.\./);
  
  // Should render SlowComponent inside Suspense
  expect(content).toMatch(/<Suspense[^>]*>[\s\S]*<\w*[Ss]low/);
});
