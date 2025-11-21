import { expect, test } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// Helper function to recursively find dynamic routes
function findDynamicRoute(dir: string): string | null {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('[') && entry.name.endsWith(']')) {
      return join(dir, entry.name);
    }

    // Recursively search subdirectories (but skip node_modules, .next, etc.)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      const result = findDynamicRoute(join(dir, entry.name));
      if (result) return result;
    }
  }

  return null;
}

test('Dynamic route directory structure exists', () => {
  // Check for dynamic route like [id] or [productId] (recursively)
  const appDir = join(process.cwd(), 'app');
  const dynamicRoutePath = findDynamicRoute(appDir);

  expect(dynamicRoutePath).not.toBeNull();
});

test('Dynamic route has server component with params', () => {
  const appDir = join(process.cwd(), 'app');
  const dynamicRoutePath = findDynamicRoute(appDir);

  if (dynamicRoutePath) {
    const pagePath = join(dynamicRoutePath, 'page.tsx');
    expect(existsSync(pagePath)).toBe(true);

    const pageContent = readFileSync(pagePath, 'utf-8');

    // Should be an async server component
    expect(pageContent).toMatch(
      /export\s+default\s+async\s+function|async\s+function.*\(/
    );

    // Should NOT have 'use client' directive
    expect(pageContent).not.toMatch(/['"]use client['"];?/);

    // Should accept params
    expect(pageContent).toMatch(/params/);

    // Should use fetch or similar for API call
    expect(pageContent).toMatch(/fetch\(|await.*fetch/);
  }
});

test('Server component uses pathname parameter for API call', () => {
  const appDir = join(process.cwd(), 'app');
  const dynamicRoutePath = findDynamicRoute(appDir);

  if (dynamicRoutePath) {
    const pagePath = join(dynamicRoutePath, 'page.tsx');
    const pageContent = readFileSync(pagePath, 'utf-8');

    // Should use the parameter in the API URL
    expect(pageContent).toMatch(
      /params\.[a-zA-Z]+|params\[['"]][a-zA-Z]+['"]\]/
    );

    // Should make API call with the parameter
    expect(pageContent).toMatch(
      /\$\{.*params.*\}|params\.[a-zA-Z]+.*\)|`.*\$\{.*params/
    );
  }
});

test('Server component displays fetched product data', () => {
  const appDir = join(process.cwd(), 'app');
  const dynamicRoutePath = findDynamicRoute(appDir);

  if (dynamicRoutePath) {
    const pagePath = join(dynamicRoutePath, 'page.tsx');
    const pageContent = readFileSync(pagePath, 'utf-8');

    // Should display product information
    expect(pageContent).toMatch(/product\.|product\[|\.name|\.title|\.price/);

    // Should convert response to JSON
    expect(pageContent).toMatch(/\.json\(\)|await.*json/);
  }
});
