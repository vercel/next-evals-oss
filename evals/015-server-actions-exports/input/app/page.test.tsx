import { expect, test } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

test('action.ts file exists', () => {
  const actionsPath = join(process.cwd(), 'app', 'action.ts');
  expect(existsSync(actionsPath)).toBe(true);
});

test('action.ts contains server action', () => {
  const actionsPath = join(process.cwd(), 'app', 'action.ts');

  if (existsSync(actionsPath)) {
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
  const actionsPath = join(process.cwd(), 'app', 'action.ts');

  if (existsSync(actionsPath)) {
    const actionsContent = readFileSync(actionsPath, 'utf-8');

    // Should be async function (server actions should be async)
    expect(actionsContent).toMatch(/async\s+function|const\s+\w+\s*=\s*async/);
  }
});
