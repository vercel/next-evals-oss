import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Page imports and uses draftMode', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should import draftMode from next/headers
  expect(content).toMatch(/import.*draftMode.*from\s+['"]next\/headers['"]/);
  
  // Should call draftMode()
  expect(content).toMatch(/draftMode\(\)/);
  
  // Should check isEnabled
  expect(content).toMatch(/isEnabled/);
});

test('Page renders draft mode status', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should render h1 with Draft Mode
  expect(content).toMatch(/<h1[^>]*>.*Draft Mode.*<\/h1>/);
  
  // Should conditionally show ON/OFF
  expect(content).toMatch(/ON.*OFF|OFF.*ON/);
  
  // Should use ternary or conditional
  expect(content).toMatch(/\?.*:|isEnabled.*\{/);
});

test('API route exists for draft mode', () => {
  const apiPath = join(process.cwd(), 'app', 'api', 'draft', 'route.ts');
  expect(existsSync(apiPath)).toBe(true);
  
  if (existsSync(apiPath)) {
    const content = readFileSync(apiPath, 'utf-8');
    
    // Should import draftMode from next/headers
    expect(content).toMatch(/import.*draftMode.*from\s+['"]next\/headers['"]/);
    
    // Should have GET handler
    expect(content).toMatch(/export\s+async\s+function\s+GET/);
  }
});

test('API route enables draft mode and redirects', () => {
  const apiPath = join(process.cwd(), 'app', 'api', 'draft', 'route.ts');
  if (existsSync(apiPath)) {
    const content = readFileSync(apiPath, 'utf-8');
    
    // Should enable draft mode
    expect(content).toMatch(/draftMode\(\)\.enable\(\)/);
    
    // Should import and use redirect
    expect(content).toMatch(/import.*redirect.*from\s+['"]next\/navigation['"]/);
    expect(content).toMatch(/redirect\(['"]\/['"]\)/);
  }
});
