import { expect, test } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Helper to find action.ts in either location
function getActionPath(): string | null {
  const appPath = join(process.cwd(), 'app', 'action.ts');
  const rootPath = join(process.cwd(), 'action.ts');

  if (existsSync(appPath)) return appPath;
  if (existsSync(rootPath)) return rootPath;
  return null;
}

test('action.ts file exists', () => {
  const actionsPath = getActionPath();
  expect(actionsPath).not.toBeNull();
});

test('action.ts contains server action', () => {
  const actionsPath = getActionPath();

  if (actionsPath) {
    const actionsContent = readFileSync(actionsPath, 'utf-8');

    // Should have 'use server' directive
    expect(actionsContent).toMatch(/['"]use server['"];?/);

    // Should export a function
    expect(actionsContent).toMatch(
      /export\s+(async\s+)?function|export\s+const\s+\w+\s*=/
    );
  }
});

test('server action is properly structured', () => {
  const actionsPath = getActionPath();

  if (actionsPath) {
    const actionsContent = readFileSync(actionsPath, 'utf-8');

    // Should be async function (server actions should be async)
    expect(actionsContent).toMatch(/async\s+function|const\s+\w+\s*=\s*async/);
  }
});
