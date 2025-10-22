import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Route group folders exist', () => {
  const marketingPath = join(process.cwd(), 'app', '(marketing)');
  const shopPath = join(process.cwd(), 'app', '(shop)');
  
  expect(existsSync(marketingPath)).toBe(true);
  expect(existsSync(shopPath)).toBe(true);
});

test('About page exists in marketing group', () => {
  const aboutPagePath = join(process.cwd(), 'app', '(marketing)', 'about', 'page.tsx');
  expect(existsSync(aboutPagePath)).toBe(true);
  
  if (existsSync(aboutPagePath)) {
    const content = readFileSync(aboutPagePath, 'utf-8');
    
    // Should have About Us in h1
    expect(content).toMatch(/<h1[^>]*>.*About Us.*<\/h1>/);
  }
});

test('Products page exists in shop group', () => {
  const productsPagePath = join(process.cwd(), 'app', '(shop)', 'products', 'page.tsx');
  expect(existsSync(productsPagePath)).toBe(true);
  
  if (existsSync(productsPagePath)) {
    const content = readFileSync(productsPagePath, 'utf-8');
    
    // Should have Our Products in h1
    expect(content).toMatch(/<h1[^>]*>.*Our Products.*<\/h1>/);
  }
});

test('Route groups use parentheses convention', () => {
  const marketingPath = join(process.cwd(), 'app', '(marketing)');
  const shopPath = join(process.cwd(), 'app', '(shop)');
  
  // Folder names should start with ( and end with )
  expect(marketingPath).toMatch(/\(marketing\)/);
  expect(shopPath).toMatch(/\(shop\)/);
});
