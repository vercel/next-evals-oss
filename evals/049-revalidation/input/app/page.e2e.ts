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

test('page has a revalidation button in a form', async ({ page }) => {
  await page.goto('/');

  // Should have a form element
  const form = page.locator('form');
  await expect(form).toBeVisible();

  // Should have a submit button for revalidation
  const button = page.locator('button[type="submit"], form button');
  await expect(button).toBeVisible();
});

test('revalidation button can be clicked', async ({ page }) => {
  await page.goto('/');

  // Find and click the revalidation button
  const button = page.locator('button[type="submit"], form button');
  await expect(button).toBeVisible();

  // The button should be clickable (form submission)
  await button.click();

  // After revalidation, the page should still show a product name
  const heading = page.locator('h1');
  await expect(heading).toBeVisible({ timeout: 5000 });
});
