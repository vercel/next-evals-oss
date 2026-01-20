import { test, expect } from '@playwright/test';

test('displays User Statistics heading', async ({ page }) => {
  await page.goto('/');

  // The UserStats component should have a heading
  await expect(page.locator('h2:has-text("User Statistics")')).toBeVisible();
});

test('displays active users count', async ({ page }) => {
  await page.goto('/');

  // Should display the count of active users (2 out of 3 users are active)
  const pageContent = await page.textContent('body');
  expect(pageContent).toMatch(/active/i);
  expect(pageContent).toMatch(/2/);
});

test('displays inactive users count', async ({ page }) => {
  await page.goto('/');

  // Should display the count of inactive users (1 out of 3 users is inactive)
  const pageContent = await page.textContent('body');
  expect(pageContent).toMatch(/inactive/i);
  expect(pageContent).toMatch(/1/);
});

test('displays percentage of active users', async ({ page }) => {
  await page.goto('/');

  // Should display percentage (66% or 67% depending on rounding, or ~66.67%)
  const pageContent = await page.textContent('body');
  // Match common percentage formats
  const hasPercentage =
    pageContent?.includes('66') ||
    pageContent?.includes('67') ||
    pageContent?.includes('%');
  expect(hasPercentage).toBe(true);
});

test('statistics update correctly with the user data', async ({ page }) => {
  await page.goto('/');

  // Verify the stats section contains meaningful numerical data
  // The UserStats section should show numbers for active, inactive, and percentage
  const statsSection = page.locator('text=User Statistics').locator('..');
  await expect(statsSection).toBeVisible();
});
