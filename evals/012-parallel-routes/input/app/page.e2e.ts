import { test, expect } from '@playwright/test';

test('displays both Analytics and Settings sections simultaneously', async ({ page }) => {
  await page.goto('/');

  // Both sections should be visible on the same page
  const analyticsSection = page.locator('text=/analytics/i');
  const settingsSection = page.locator('text=/settings/i');

  await expect(analyticsSection).toBeVisible();
  await expect(settingsSection).toBeVisible();
});

test('Analytics section contains relevant content', async ({ page }) => {
  await page.goto('/');

  // The Analytics section should be identifiable and contain analytics-related content
  const analyticsContent = page.locator('text=/analytics/i');
  await expect(analyticsContent).toBeVisible();
});

test('Settings section contains relevant content', async ({ page }) => {
  await page.goto('/');

  // The Settings section should be identifiable and contain settings-related content
  const settingsContent = page.locator('text=/settings/i');
  await expect(settingsContent).toBeVisible();
});

test('both sections render without overlapping each other', async ({ page }) => {
  await page.goto('/');

  // Get the bounding boxes of both sections to ensure they don't completely overlap
  const analyticsLocator = page.locator('text=/analytics/i').first();
  const settingsLocator = page.locator('text=/settings/i').first();

  const analyticsBox = await analyticsLocator.boundingBox();
  const settingsBox = await settingsLocator.boundingBox();

  // Both should have bounding boxes (be rendered)
  expect(analyticsBox).toBeTruthy();
  expect(settingsBox).toBeTruthy();

  // They should not be at the exact same position (indicating they're rendered separately)
  if (analyticsBox && settingsBox) {
    const samePosition = analyticsBox.x === settingsBox.x && analyticsBox.y === settingsBox.y;
    expect(samePosition).toBe(false);
  }
});
