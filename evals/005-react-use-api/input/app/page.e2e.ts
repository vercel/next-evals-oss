import { test, expect } from '@playwright/test';

test('displays the fetched data as JSON', async ({ page }) => {
  await page.goto('/');

  // The page should display the data as JSON
  const content = await page.textContent('body');
  expect(content).toContain('test');
  expect(content).toContain('data');
  expect(content).toContain('Hello from promise');
});

test('data is rendered correctly as JSON string', async ({ page }) => {
  await page.goto('/');

  // Should show properly formatted JSON with the expected data
  await expect(page.locator('text={"test":"data","message":"Hello from promise"}')).toBeVisible();
});
