import { test, expect } from '@playwright/test';

test('main page has a link to photo 1', async ({ page }) => {
  await page.goto('/');

  // Should have a link to /photo/1
  const link = page.locator('a[href="/photo/1"]');
  await expect(link).toBeVisible();
});

test('clicking photo link shows modal content', async ({ page }) => {
  await page.goto('/');

  // Click the photo link
  await page.click('a[href="/photo/1"]');

  // Should show modal-related content (intercepted route)
  // Look for "Modal" text indicating the intercepted view
  await expect(page.locator('text=Modal')).toBeVisible({ timeout: 5000 });
});

test('direct navigation to /photo/1 shows full page', async ({ page }) => {
  // Navigate directly to the photo URL
  await page.goto('/photo/1');

  // Should show full page content with "Page" text (not intercepted)
  await expect(page.locator('text=Page')).toBeVisible({ timeout: 5000 });
});
