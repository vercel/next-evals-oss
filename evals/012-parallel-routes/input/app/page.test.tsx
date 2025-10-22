import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Parallel routes directory structure exists', () => {
  // Check for @analytics parallel route
  const analyticsPath = join(process.cwd(), 'app', '@analytics');
  expect(existsSync(analyticsPath)).toBe(true);

  // Check for @settings parallel route
  const settingsPath = join(process.cwd(), 'app', '@settings');
  expect(existsSync(settingsPath)).toBe(true);

  // Check for page files in parallel routes
  const analyticsPagePath = join(
    process.cwd(),
    'app',
    '@analytics',
    'page.tsx'
  );
  expect(existsSync(analyticsPagePath)).toBe(true);

  const settingsPagePath = join(process.cwd(), 'app', '@settings', 'page.tsx');
  expect(existsSync(settingsPagePath)).toBe(true);
});

test('Layout accepts parallel route props', () => {
  const layoutPath = join(process.cwd(), 'app', 'layout.tsx');
  const layoutContent = readFileSync(layoutPath, 'utf-8');

  // Layout should accept analytics and settings as props
  expect(layoutContent).toMatch(/analytics|settings/);

  // Should have parameters for parallel routes
  expect(layoutContent).toMatch(/\{.*analytics.*\}|\{.*settings.*\}/);
});

test('Parallel route pages have proper content', () => {
  const analyticsPagePath = join(
    process.cwd(),
    'app',
    '@analytics',
    'page.tsx'
  );
  const settingsPagePath = join(process.cwd(), 'app', '@settings', 'page.tsx');

  if (existsSync(analyticsPagePath)) {
    const analyticsContent = readFileSync(analyticsPagePath, 'utf-8');
    expect(analyticsContent).toMatch(/analytics/i);
  }

  if (existsSync(settingsPagePath)) {
    const settingsContent = readFileSync(settingsPagePath, 'utf-8');
    expect(settingsContent).toMatch(/settings/i);
  }
});

test('Layout renders parallel routes simultaneously', () => {
  const layoutPath = join(process.cwd(), 'app', 'layout.tsx');
  const layoutContent = readFileSync(layoutPath, 'utf-8');

  // Should render both analytics and settings in the layout
  expect(layoutContent).toMatch(/\{analytics\}|\{.*analytics.*\}/);
  expect(layoutContent).toMatch(/\{settings\}|\{.*settings.*\}/);
});
