import { test, expect } from '@playwright/test';

test('displays the first product name in an h1 heading', async ({ page }) => {
  await page.goto('/');

  // The page should display the first product name in an h1
  const heading = page.locator('h1');
  await expect(heading).toBeVisible();

  // The heading should contain text (the product name)
  const headingText = await heading.textContent();
  expect(headingText).toBeTruthy();
  expect(headingText!.trim().length).toBeGreaterThan(0);
});

test('product name matches first item from API', async ({ page }) => {
  // Fetch the expected first product name directly from the API
  const response = await fetch('https://api.vercel.app/products');
  const products = await response.json();
  const expectedName = products[0].name;

  await page.goto('/');

  // The h1 should contain the first product's name
  const heading = page.locator('h1');
  await expect(heading).toContainText(expectedName);
});
