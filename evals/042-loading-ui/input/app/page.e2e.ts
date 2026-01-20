import { test, expect } from '@playwright/test';

test('displays content after loading completes', async ({ page }) => {
  await page.goto('/');

  // Wait for the content to load
  const heading = page.locator('h1', { hasText: 'Content Loaded' });
  await expect(heading).toBeVisible({ timeout: 10000 });
});

test('page loads without errors', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  // Final content should be visible
  const heading = page.locator('h1', { hasText: 'Content Loaded' });
  await expect(heading).toBeVisible({ timeout: 10000 });
});
