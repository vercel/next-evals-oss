import { test, expect } from '@playwright/test';

test('shows loading state initially', async ({ page }) => {
  // Navigate to the page
  await page.goto('/');

  // The loading indicator should be visible initially
  const loadingElement = page.locator('text=Loading...');
  await expect(loadingElement).toBeVisible({ timeout: 1000 });
});

test('displays content after loading completes', async ({ page }) => {
  await page.goto('/');

  // Wait for the content to load (should take about 2 seconds)
  const heading = page.locator('h1', { hasText: 'Content Loaded' });
  await expect(heading).toBeVisible({ timeout: 5000 });
});

test('loading state disappears after content loads', async ({ page }) => {
  await page.goto('/');

  // Wait for content to appear
  const heading = page.locator('h1', { hasText: 'Content Loaded' });
  await expect(heading).toBeVisible({ timeout: 5000 });

  // Loading indicator should no longer be visible
  const loadingElement = page.locator('text=Loading...');
  await expect(loadingElement).not.toBeVisible();
});
