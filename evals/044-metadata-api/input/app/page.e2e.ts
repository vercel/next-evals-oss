import { test, expect } from '@playwright/test';

test.describe('Metadata API', () => {
  test('page has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('My App');
  });

  test('page has correct meta description', async ({ page }) => {
    await page.goto('/');
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', 'Welcome to my application');
  });

  test('page has OpenGraph title', async ({ page }) => {
    await page.goto('/');
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', 'My App OG');
  });

  test('page has OpenGraph description', async ({ page }) => {
    await page.goto('/');
    const ogDescription = page.locator('meta[property="og:description"]');
    await expect(ogDescription).toHaveAttribute('content', 'OG Description');
  });

  test('page displays main heading', async ({ page }) => {
    await page.goto('/');
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Metadata Example');
  });
});
