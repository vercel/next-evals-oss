import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Intercepting route folder exists', () => {
  const interceptingPath = join(process.cwd(), 'app', '(.)photo', '[id]');
  expect(existsSync(interceptingPath)).toBe(true);
});

test('Regular route folder exists', () => {
  const regularPath = join(process.cwd(), 'app', 'photo', '[id]');
  expect(existsSync(regularPath)).toBe(true);
});

test('Intercepting route page shows modal', () => {
  const interceptingPagePath = join(process.cwd(), 'app', '(.)photo', '[id]', 'page.tsx');
  if (existsSync(interceptingPagePath)) {
    const content = readFileSync(interceptingPagePath, 'utf-8');
    
    // Should have modal className
    expect(content).toMatch(/className=["']modal["']/);
    
    // Should show Modal text
    expect(content).toMatch(/Modal/);
    
    // Should handle params.id
    expect(content).toMatch(/params\.id|params\[['"]id['"]\]/);
  }
});

test('Regular route page shows full page', () => {
  const regularPagePath = join(process.cwd(), 'app', 'photo', '[id]', 'page.tsx');
  if (existsSync(regularPagePath)) {
    const content = readFileSync(regularPagePath, 'utf-8');
    
    // Should have page className
    expect(content).toMatch(/className=["']page["']/);
    
    // Should show Page text
    expect(content).toMatch(/Page/);
    
    // Should handle params.id
    expect(content).toMatch(/params\.id|params\[['"]id['"]\]/);
  }
});

test('Main page has link to photo', () => {
  const mainPagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(mainPagePath, 'utf-8');
  
  // Should have Link component or anchor to /photo/1
  expect(content).toMatch(/href=["']\/photo\/1["']|to=["']\/photo\/1["']/);
});
