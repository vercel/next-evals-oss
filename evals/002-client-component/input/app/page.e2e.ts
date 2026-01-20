import { test, expect } from '@playwright/test';

test('counter increments on click', async ({ page }) => {
  await page.goto('/');

  // Initial state
  await expect(page.locator('text=Count: 0')).toBeVisible();

  // Click increment
  await page.click('button');
  await expect(page.locator('text=Count: 1')).toBeVisible();

  // Click again
  await page.click('button');
  await expect(page.locator('text=Count: 2')).toBeVisible();
});
