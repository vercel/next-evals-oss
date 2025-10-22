import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Loading.tsx file exists', () => {
  const loadingPath = join(process.cwd(), 'app', 'loading.tsx');
  expect(existsSync(loadingPath)).toBe(true);
});

test('Loading component shows loading spinner', () => {
  const loadingPath = join(process.cwd(), 'app', 'loading.tsx');
  if (existsSync(loadingPath)) {
    const content = readFileSync(loadingPath, 'utf-8');
    
    // Should have loading-spinner className
    expect(content).toMatch(/className=["']loading-spinner["']/);
    
    // Should show Loading... text
    expect(content).toMatch(/Loading\.\.\./);
    
    // Should export default function
    expect(content).toMatch(/export\s+default\s+function/);
  }
});

test('Page is an async server component with delay', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should be async function
  expect(content).toMatch(/export\s+default\s+async\s+function|async\s+function.*Page/);
  
  // Should have Promise with setTimeout for delay
  expect(content).toMatch(/new\s+Promise.*setTimeout|setTimeout.*Promise/);
  
  // Should have 2000ms delay
  expect(content).toMatch(/2000/);
});

test('Page shows content loaded message', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should render h1 with Content Loaded
  expect(content).toMatch(/<h1[^>]*>.*Content Loaded.*<\/h1>/);
});
