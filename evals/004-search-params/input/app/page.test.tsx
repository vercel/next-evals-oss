import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('Page is a server component with proper TypeScript types', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  
  // Should NOT have 'use client' directive
  expect(pageContent).not.toMatch(/['"]use client['"];?/);
  
  // Should have TypeScript types for props
  expect(pageContent).toMatch(/interface|type.*Props|searchParams.*:/);
});

test('Page handles async searchParams correctly', async () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  
  // Should await searchParams since it's a Promise in Next.js v15
  expect(pageContent).toMatch(/await.*searchParams/);
  
  // Should be an async function
  expect(pageContent).toMatch(/async\s+function|export\s+default\s+async/);
});

test('Page reads search params and forwards to Client component', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  
  // Should import Client component
  expect(pageContent).toMatch(/import.*Client.*from/);
  
  // Should render Client component with name prop
  expect(pageContent).toMatch(/<Client.*name.*=/);
  
});

test('Page extracts name parameter from searchParams', () => {
  const pageContent = readFileSync(join(process.cwd(), 'app', 'page.tsx'), 'utf-8');
  // Should pass name prop to Client component
  expect(pageContent).toMatch(/name.*=/);
});
