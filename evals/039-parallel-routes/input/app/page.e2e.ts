import { test, expect } from '@playwright/test';

test('displays both analytics and team sections on the dashboard', async ({ page }) => {
  await page.goto('/');

  // Both sections should be visible on the page
  const analyticsSection = page.locator('.analytics');
  const teamSection = page.locator('.team');

  await expect(analyticsSection).toBeVisible();
  await expect(teamSection).toBeVisible();
});

test('analytics section contains Analytics Dashboard text', async ({ page }) => {
  await page.goto('/');

  const analyticsSection = page.locator('.analytics');
  await expect(analyticsSection).toContainText('Analytics Dashboard');
});

test('team section contains Team Overview text', async ({ page }) => {
  await page.goto('/');

  const teamSection = page.locator('.team');
  await expect(teamSection).toContainText('Team Overview');
});

test('both sections are rendered simultaneously', async ({ page }) => {
  await page.goto('/');

  // Verify both sections exist in the DOM at the same time
  const analyticsCount = await page.locator('.analytics').count();
  const teamCount = await page.locator('.team').count();

  expect(analyticsCount).toBe(1);
  expect(teamCount).toBe(1);
});
