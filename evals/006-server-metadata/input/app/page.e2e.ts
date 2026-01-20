import { test, expect } from '@playwright/test';

test('page has correct title metadata', async ({ page }) => {
  await page.goto('/');

  // The page should have the correct title
  await expect(page).toHaveTitle('My Page');
});

test('page has correct description metadata', async ({ page }) => {
  await page.goto('/');

  // The page should have the correct meta description
  const metaDescription = page.locator('meta[name="description"]');
  await expect(metaDescription).toHaveAttribute('content', 'Test');
});

test('page displays content', async ({ page }) => {
  await page.goto('/');

  // The page should display the expected content
  await expect(page.getByText('Page Content')).toBeVisible();
});
