import { test, expect } from '@playwright/test';

test('blog post page displays the correct heading for id 1', async ({ page }) => {
  await page.goto('/blog/1');

  // The page should display "Blog Post 1" in a heading
  const heading = page.locator('h1');
  await expect(heading).toBeVisible();
  await expect(heading).toContainText('Blog Post 1');
});

test('blog post page is accessible at /blog/1', async ({ page }) => {
  const response = await page.goto('/blog/1');

  // The page should load successfully (not 404)
  expect(response?.status()).toBe(200);
});
