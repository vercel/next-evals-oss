import { test, expect } from '@playwright/test';

test('displays product list from database', async ({ page }) => {
  await page.goto('/');

  // Should display product names from the database
  await expect(page.getByText('Laptop')).toBeVisible();
  await expect(page.getByText('Phone')).toBeVisible();
  await expect(page.getByText('Tablet')).toBeVisible();
});

test('has a refresh/invalidate button in a form', async ({ page }) => {
  await page.goto('/');

  // Should have a form with a submit button for cache invalidation
  const form = page.locator('form');
  await expect(form).toBeVisible();

  const submitButton = page.locator('button[type="submit"], form button').first();
  await expect(submitButton).toBeVisible();
});

test('refresh button reloads page with fresh data', async ({ page }) => {
  await page.goto('/');

  // Verify products are visible initially
  await expect(page.getByText('Laptop')).toBeVisible();

  // Click the refresh/submit button
  const submitButton = page.locator('button[type="submit"], form button').first();
  await submitButton.click();

  // Wait for page to update (form submission triggers revalidation)
  await page.waitForTimeout(500);

  // Products should still be visible after refresh
  await expect(page.getByText('Laptop')).toBeVisible();
});
