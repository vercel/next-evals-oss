import { test, expect } from '@playwright/test';

test('main page has a link to photo 1', async ({ page }) => {
  await page.goto('/');

  // Should have a link to /photo/1
  const link = page.locator('a[href="/photo/1"]');
  await expect(link).toBeVisible();
});

test('clicking photo link shows modal instead of full page navigation', async ({ page }) => {
  await page.goto('/');

  // Click the photo link
  await page.click('a[href="/photo/1"]');

  // Should show modal content (intercepted route)
  const modal = page.locator('.modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Photo 1 Modal');
});

test('direct navigation to /photo/1 shows full page', async ({ page }) => {
  // Navigate directly to the photo URL
  await page.goto('/photo/1');

  // Should show full page content (not intercepted)
  const pageContent = page.locator('.page');
  await expect(pageContent).toBeVisible();
  await expect(pageContent).toContainText('Photo 1 Page');
});

test('modal is not shown on direct navigation', async ({ page }) => {
  // Navigate directly to the photo URL
  await page.goto('/photo/1');

  // Modal should not be present
  const modal = page.locator('.modal');
  await expect(modal).not.toBeVisible();
});
