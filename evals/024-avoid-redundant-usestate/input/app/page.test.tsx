import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import Page from './page';

test('Page renders correctly', () => {
  render(<Page />);
  expect(screen.getByRole('heading', { level: 1, name: 'User Management' })).toBeDefined();
});

test('UserStats component avoids redundant useState', () => {
  const userStatsContent = readFileSync(join(process.cwd(), 'app', 'UserStats.tsx'), 'utf-8');
  
  // Should NOT use useState for calculated values
  expect(userStatsContent).not.toMatch(/useState.*active|active.*useState/);
  expect(userStatsContent).not.toMatch(/useState.*count|count.*useState/);
  expect(userStatsContent).not.toMatch(/useState.*percentage|percentage.*useState/);
  
  // Should NOT use useEffect to update derived state
  expect(userStatsContent).not.toMatch(/useEffect/);
});

test('UserStats component computes derived values directly', () => {
  const userStatsContent = readFileSync(join(process.cwd(), 'app', 'UserStats.tsx'), 'utf-8');
  
  // Should compute values directly from props
  const hasDirectComputation = 
    userStatsContent.includes('.filter(') ||
    userStatsContent.includes('.length') ||
    userStatsContent.includes('users.') ||
    userStatsContent.includes('isActive');
  
  expect(hasDirectComputation).toBe(true);
  
  // Should calculate percentage
  const hasPercentageCalc = 
    userStatsContent.includes('percentage') ||
    userStatsContent.includes('%') ||
    userStatsContent.includes('* 100') ||
    userStatsContent.includes('Math.');
  
  expect(hasPercentageCalc).toBe(true);
});

test('UserStats displays all required statistics', () => {
  const userStatsContent = readFileSync(join(process.cwd(), 'app', 'UserStats.tsx'), 'utf-8');
  
  // Should display active count, inactive count, and percentage
  const displaysStats = 
    userStatsContent.includes('active') &&
    userStatsContent.includes('inactive') &&
    (userStatsContent.includes('percentage') || userStatsContent.includes('%'));
  
  expect(displaysStats).toBe(true);
});
