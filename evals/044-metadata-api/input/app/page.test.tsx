import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('Page exports metadata object', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should export metadata
  expect(content).toMatch(/export\s+const\s+metadata/);
  
  // Should NOT be a client component
  expect(content).not.toMatch(/['"]use client['"]/);
});

test('Metadata has correct properties', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have title
  expect(content).toMatch(/title:\s*['"]My App['"]/);
  
  // Should have description
  expect(content).toMatch(/description:\s*['"]Welcome to my application['"]/);
});

test('Metadata includes OpenGraph configuration', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have openGraph object
  expect(content).toMatch(/openGraph:\s*{/);
  
  // Should have OG title
  expect(content).toMatch(/title:\s*['"]My App OG['"]/);
  
  // Should have OG description
  expect(content).toMatch(/description:\s*['"]OG Description['"]/);
});

test('Page renders correct content', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should render h1 with Metadata Example
  expect(content).toMatch(/<h1[^>]*>.*Metadata Example.*<\/h1>/);
});
