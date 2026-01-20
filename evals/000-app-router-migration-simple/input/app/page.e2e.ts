import { test, expect } from '@playwright/test';

test('home page displays main heading', async ({ page }) => {
  await page.goto('/');

  const heading = page.locator('h1');
  await expect(heading).toContainText('Home');
});

test('page loads without errors', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
});

test('page has proper HTML structure', async ({ page }) => {
  await page.goto('/');

  // Should have proper html and body elements
  const html = page.locator('html');
  const body = page.locator('body');

  await expect(html).toBeAttached();
  await expect(body).toBeAttached();
});
