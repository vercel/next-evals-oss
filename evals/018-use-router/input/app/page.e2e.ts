import { test, expect } from '@playwright/test';

test('page has a Navigate button', async ({ page }) => {
  await page.goto('/');

  // The page should have a button with text "Navigate"
  const button = page.getByRole('button', { name: 'Navigate' });
  await expect(button).toBeVisible();
});

test('clicking Navigate button navigates to /about', async ({ page }) => {
  await page.goto('/');

  // Click the Navigate button
  const button = page.getByRole('button', { name: 'Navigate' });
  await button.click();

  // Should navigate to /about
  await expect(page).toHaveURL(/\/about/);
});
