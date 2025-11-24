import { expect, test } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

test('Parallel routes directory structure exists', () => {
  // Check for @analytics parallel route (support both root and nested patterns)
  const analyticsPathRoot = join(process.cwd(), 'app', '@analytics');
  const analyticsPathDashboard = join(process.cwd(), 'app', 'dashboard', '@analytics');
  const analyticsExists = existsSync(analyticsPathRoot) || existsSync(analyticsPathDashboard);
  expect(analyticsExists).toBe(true);

  // Check for @settings parallel route (support both root and nested patterns)
  const settingsPathRoot = join(process.cwd(), 'app', '@settings');
  const settingsPathDashboard = join(process.cwd(), 'app', 'dashboard', '@settings');
  const settingsExists = existsSync(settingsPathRoot) || existsSync(settingsPathDashboard);
  expect(settingsExists).toBe(true);

  // Check for page files in parallel routes (support both patterns)
  const analyticsPagePathRoot = join(process.cwd(), 'app', '@analytics', 'page.tsx');
  const analyticsPagePathDashboard = join(process.cwd(), 'app', 'dashboard', '@analytics', 'page.tsx');
  const analyticsPageExists = existsSync(analyticsPagePathRoot) || existsSync(analyticsPagePathDashboard);
  expect(analyticsPageExists).toBe(true);

  const settingsPagePathRoot = join(process.cwd(), 'app', '@settings', 'page.tsx');
  const settingsPagePathDashboard = join(process.cwd(), 'app', 'dashboard', '@settings', 'page.tsx');
  const settingsPageExists = existsSync(settingsPagePathRoot) || existsSync(settingsPagePathDashboard);
  expect(settingsPageExists).toBe(true);
});

test('Layout accepts parallel route props', () => {
  // Check both root layout and dashboard layout (support both patterns)
  const rootLayoutPath = join(process.cwd(), 'app', 'layout.tsx');
  const dashboardLayoutPath = join(process.cwd(), 'app', 'dashboard', 'layout.tsx');

  let layoutContent = '';
  if (existsSync(dashboardLayoutPath)) {
    layoutContent = readFileSync(dashboardLayoutPath, 'utf-8');
  } else if (existsSync(rootLayoutPath)) {
    layoutContent = readFileSync(rootLayoutPath, 'utf-8');
  }

  // Layout should accept analytics and settings as props
  expect(layoutContent).toMatch(/analytics|settings/);

  // Should have parameters for parallel routes
  expect(layoutContent).toMatch(/\{.*analytics.*\}|\{.*settings.*\}/);
});

test('Parallel route pages have proper content', () => {
  // Check both root and dashboard patterns for @analytics
  const analyticsPagePathRoot = join(process.cwd(), 'app', '@analytics', 'page.tsx');
  const analyticsPagePathDashboard = join(process.cwd(), 'app', 'dashboard', '@analytics', 'page.tsx');

  if (existsSync(analyticsPagePathRoot)) {
    const analyticsContent = readFileSync(analyticsPagePathRoot, 'utf-8');
    expect(analyticsContent).toMatch(/analytics/i);
  } else if (existsSync(analyticsPagePathDashboard)) {
    const analyticsContent = readFileSync(analyticsPagePathDashboard, 'utf-8');
    expect(analyticsContent).toMatch(/analytics/i);
  }

  // Check both root and dashboard patterns for @settings
  const settingsPagePathRoot = join(process.cwd(), 'app', '@settings', 'page.tsx');
  const settingsPagePathDashboard = join(process.cwd(), 'app', 'dashboard', '@settings', 'page.tsx');

  if (existsSync(settingsPagePathRoot)) {
    const settingsContent = readFileSync(settingsPagePathRoot, 'utf-8');
    expect(settingsContent).toMatch(/settings/i);
  } else if (existsSync(settingsPagePathDashboard)) {
    const settingsContent = readFileSync(settingsPagePathDashboard, 'utf-8');
    expect(settingsContent).toMatch(/settings/i);
  }
});

test('Layout renders parallel routes simultaneously', () => {
  // Check both root layout and dashboard layout (support both patterns)
  const rootLayoutPath = join(process.cwd(), 'app', 'layout.tsx');
  const dashboardLayoutPath = join(process.cwd(), 'app', 'dashboard', 'layout.tsx');

  let layoutContent = '';
  if (existsSync(dashboardLayoutPath)) {
    layoutContent = readFileSync(dashboardLayoutPath, 'utf-8');
  } else if (existsSync(rootLayoutPath)) {
    layoutContent = readFileSync(rootLayoutPath, 'utf-8');
  }

  // Should render both analytics and settings in the layout
  expect(layoutContent).toMatch(/\{analytics\}|\{.*analytics.*\}/);
  expect(layoutContent).toMatch(/\{settings\}|\{.*settings.*\}/);
});
