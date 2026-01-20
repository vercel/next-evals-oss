import { test, expect } from '@playwright/test';

test('displays search query from URL search params', async ({ page }) => {
  await page.goto('/?query=hello');

  // Should display the search query
  await expect(page.locator('[data-testid="search-display"]')).toContainText('hello');
});

test('handles different search values', async ({ page }) => {
  await page.goto('/?query=world');

  await expect(page.locator('[data-testid="search-display"]')).toContainText('world');
});

test('handles empty search params gracefully', async ({ page }) => {
  await page.goto('/');

  // Page should load without errors
  await expect(page.locator('[data-testid="search-display"]')).toBeVisible();
});
