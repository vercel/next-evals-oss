import { test, expect } from '@playwright/test';

test('page has correct title metadata', async ({ page }) => {
  await page.goto('/');

  // The page should have the correct title set by the client component
  await expect(page).toHaveTitle('My Page');
});

test('page has correct description metadata', async ({ page }) => {
  await page.goto('/');

  // The page should have the correct meta description
  const metaDescription = page.locator('meta[name="description"]');
  await expect(metaDescription).toHaveAttribute('content', 'Test');
});

test('page displays Home heading', async ({ page }) => {
  await page.goto('/');

  // The page should display the Home heading
  await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
});
