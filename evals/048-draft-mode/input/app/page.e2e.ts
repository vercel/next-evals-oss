import { test, expect } from '@playwright/test';

test('displays draft mode OFF by default', async ({ page }) => {
  await page.goto('/');

  const heading = page.locator('h1');
  await expect(heading).toContainText('Draft Mode: OFF');
});

test('displays draft mode ON after enabling via API', async ({ page, context }) => {
  // First, enable draft mode via the API route
  await page.goto('/api/draft');

  // The API route should redirect to the home page with draft mode enabled
  await page.waitForURL('/');

  const heading = page.locator('h1');
  await expect(heading).toContainText('Draft Mode: ON');
});

test('API route at /api/draft exists and redirects', async ({ page }) => {
  const response = await page.goto('/api/draft');

  // After redirect, should be on home page
  await expect(page).toHaveURL('/');
});
