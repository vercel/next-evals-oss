import { test, expect } from '@playwright/test';

test('about page displays "About Us" heading at /about', async ({ page }) => {
  await page.goto('/about');

  const heading = page.locator('h1');
  await expect(heading).toBeVisible();
  await expect(heading).toContainText('About Us');
});

test('products page displays "Our Products" heading at /products', async ({ page }) => {
  await page.goto('/products');

  const heading = page.locator('h1');
  await expect(heading).toBeVisible();
  await expect(heading).toContainText('Our Products');
});

test('route groups do not appear in URLs', async ({ page }) => {
  // Verify /about works (not /(marketing)/about)
  const aboutResponse = await page.goto('/about');
  expect(aboutResponse?.status()).toBe(200);

  // Verify /products works (not /(shop)/products)
  const productsResponse = await page.goto('/products');
  expect(productsResponse?.status()).toBe(200);
});
