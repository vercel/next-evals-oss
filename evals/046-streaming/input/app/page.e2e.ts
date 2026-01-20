import { test, expect } from '@playwright/test';

test('shows Dashboard header immediately', async ({ page }) => {
  await page.goto('/');

  // The header should be visible immediately
  const heading = page.locator('h1');
  await expect(heading).toBeVisible();
  await expect(heading).toContainText('Dashboard');
});

test('shows loading state while data is being fetched', async ({ page }) => {
  await page.goto('/');

  // Should show loading indicator initially
  await expect(page.locator('text=Loading data...')).toBeVisible();
});

test('displays loaded data after streaming completes', async ({ page }) => {
  await page.goto('/');

  // Wait for the slow content to load (3+ seconds)
  await expect(page.locator('text=Data loaded!')).toBeVisible({ timeout: 10000 });
});

test('header remains visible during entire loading process', async ({ page }) => {
  await page.goto('/');

  // Header should be visible initially
  const heading = page.locator('h1');
  await expect(heading).toContainText('Dashboard');

  // Wait for data to load
  await expect(page.locator('text=Data loaded!')).toBeVisible({ timeout: 10000 });

  // Header should still be visible after data loads
  await expect(heading).toBeVisible();
  await expect(heading).toContainText('Dashboard');
});
