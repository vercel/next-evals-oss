import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('Page is async server component with revalidation', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should be async function
  expect(content).toMatch(/export\s+default\s+async\s+function|async\s+function.*Page/);
  
  // Should fetch from correct API
  expect(content).toMatch(/api\.vercel\.app\/products/);
  
  // Should have revalidate option
  expect(content).toMatch(/revalidate:\s*60/);
});

test('Page uses proper fetch options for caching', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should use next cache options
  expect(content).toMatch(/next:\s*{/);
  
  // Should have cache tags
  expect(content).toMatch(/tags:\s*\[.*products.*\]/);
  
  // Should render first product name
  expect(content).toMatch(/products\[0\]\.name|\[0\]\.name/);
});

test('Server action for revalidation exists', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should import revalidateTag
  expect(content).toMatch(/import.*revalidateTag.*from\s+['"]next\/cache['"]/);
  
  // Should have server action
  expect(content).toMatch(/['"]use server['"]/);
  
  // Should call revalidateTag
  expect(content).toMatch(/revalidateTag\(['"]products['"]\)/);
});

test('Page includes revalidation form', () => {
  const pagePath = join(process.cwd(), 'app', 'page.tsx');
  const content = readFileSync(pagePath, 'utf-8');
  
  // Should have form with action
  expect(content).toMatch(/<form[^>]*action=/);
  
  // Should have submit button
  expect(content).toMatch(/<button[^>]*type=["']submit["']/);
});
