import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Error.tsx file exists', () => {
  const errorPath = join(process.cwd(), 'app', 'error.tsx');
  expect(existsSync(errorPath)).toBe(true);
});

test('Error component is a client component', () => {
  const errorPath = join(process.cwd(), 'app', 'error.tsx');
  if (existsSync(errorPath)) {
    const content = readFileSync(errorPath, 'utf-8');
    
    // Should have 'use client' directive
    expect(content).toMatch(/['"]use client['"]/);
  }
});

test('Error component has correct structure', () => {
  const errorPath = join(process.cwd(), 'app', 'error.tsx');
  if (existsSync(errorPath)) {
    const content = readFileSync(errorPath, 'utf-8');
    
    // Should receive error and reset props
    expect(content).toMatch(/error/);
    expect(content).toMatch(/reset/);
    
    // Should display error message in h1
    expect(content).toMatch(/<h1[^>]*>.*Something went wrong.*<\/h1>/);
    
    // Should have Try again button
    expect(content).toMatch(/<button[^>]*>.*Try again.*<\/button>/);
    
    // Button should call reset
    expect(content).toMatch(/onClick.*reset|reset.*onClick/);
  }
});

test('Page throws test error', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should throw an error
  expect(content).toMatch(/throw\s+new\s+Error/);
  
  // Error message should be 'Test error'
  expect(content).toMatch(/Test error/);
});
