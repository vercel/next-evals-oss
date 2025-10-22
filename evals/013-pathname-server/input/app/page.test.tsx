import { expect, test } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

test('Dynamic route directory structure exists', () => {
  // Check for dynamic route like [id] or [productId]
  const appDir = join(process.cwd(), 'app');
  const entries = readdirSync(appDir, { withFileTypes: true });

  const hasDynamicRoute = entries.some(
    (entry: any) =>
      entry.isDirectory() &&
      entry.name.startsWith('[') &&
      entry.name.endsWith(']')
  );

  expect(hasDynamicRoute).toBe(true);
});

test('Dynamic route has server component with params', () => {
  const appDir = join(process.cwd(), 'app');
  const entries = readdirSync(appDir, { withFileTypes: true });

  const dynamicRoute = entries.find(
    (entry: any) =>
      entry.isDirectory() &&
      entry.name.startsWith('[') &&
      entry.name.endsWith(']')
  );

  if (dynamicRoute) {
    const pagePath = join(appDir, dynamicRoute.name, 'page.tsx');
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
  const entries = readdirSync(appDir, { withFileTypes: true });

  const dynamicRoute = entries.find(
    (entry: any) =>
      entry.isDirectory() &&
      entry.name.startsWith('[') &&
      entry.name.endsWith(']')
  );

  if (dynamicRoute) {
    const pagePath = join(appDir, dynamicRoute.name, 'page.tsx');
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
  const entries = readdirSync(appDir, { withFileTypes: true });

  const dynamicRoute = entries.find(
    (entry: any) =>
      entry.isDirectory() &&
      entry.name.startsWith('[') &&
      entry.name.endsWith(']')
  );

  if (dynamicRoute) {
    const pagePath = join(appDir, dynamicRoute.name, 'page.tsx');
    const pageContent = readFileSync(pagePath, 'utf-8');

    // Should display product information
    expect(pageContent).toMatch(/product\.|product\[|\.name|\.title|\.price/);

    // Should convert response to JSON
    expect(pageContent).toMatch(/\.json\(\)|await.*json/);
  }
});
