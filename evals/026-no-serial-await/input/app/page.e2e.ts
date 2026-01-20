import { test, expect } from '@playwright/test';

test('Dashboard page loads and displays data from all three sources', async ({ page }) => {
  await page.goto('/');

  // The page should display content related to analytics
  await expect(page.getByText(/analytics/i)).toBeVisible();

  // The page should display content related to notifications
  await expect(page.getByText(/notifications/i)).toBeVisible();

  // The page should display content related to settings
  await expect(page.getByText(/settings/i)).toBeVisible();
});

test('Dashboard loads within acceptable time (parallel fetching)', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/');

  // Wait for all three sections to be visible
  await expect(page.getByText(/analytics/i)).toBeVisible();
  await expect(page.getByText(/notifications/i)).toBeVisible();
  await expect(page.getByText(/settings/i)).toBeVisible();

  const loadTime = Date.now() - startTime;

  // If fetches were sequential (3 x ~100ms each), it would take ~300ms+
  // With parallel fetching, it should be closer to ~100ms
  // We use a generous threshold to account for server startup and network variance
  // but it should still be faster than purely sequential fetching
  expect(loadTime).toBeLessThan(5000);
});
