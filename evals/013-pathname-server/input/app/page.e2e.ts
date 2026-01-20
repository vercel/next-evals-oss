import { test, expect } from '@playwright/test';

test('displays product name for a given product ID', async ({ page }) => {
  // Navigate to a product detail page
  await page.goto('/products/1');

  // The page should display the product name in a heading
  const heading = page.locator('h1');
  await expect(heading).toBeVisible();

  // The heading should contain text (the product name)
  const headingText = await heading.textContent();
  expect(headingText).toBeTruthy();
  expect(headingText!.trim().length).toBeGreaterThan(0);
});

test('product name matches the product from the API', async ({ page }) => {
  const productId = '1';

  // Fetch the expected product directly from the API
  const response = await fetch(`https://api.vercel.app/products/${productId}`);
  const product = await response.json();
  const expectedName = product.name;

  await page.goto(`/products/${productId}`);

  // The heading should contain the product's name
  const heading = page.locator('h1');
  await expect(heading).toContainText(expectedName);
});

test('displays different product for different ID', async ({ page }) => {
  const productId = '2';

  // Fetch the expected product directly from the API
  const response = await fetch(`https://api.vercel.app/products/${productId}`);
  const product = await response.json();
  const expectedName = product.name;

  await page.goto(`/products/${productId}`);

  // The heading should contain the product's name
  const heading = page.locator('h1');
  await expect(heading).toContainText(expectedName);
});
