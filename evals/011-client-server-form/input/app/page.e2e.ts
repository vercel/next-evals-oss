import { test, expect } from '@playwright/test';

test('form submits and shows success message with user data', async ({ page }) => {
  await page.goto('/');

  // Find and fill the name input
  const nameInput = page.locator('input[name="name"], input[type="text"]').first();
  await expect(nameInput).toBeVisible();
  await nameInput.fill('John Doe');

  // Find and fill the email input
  const emailInput = page.locator('input[name="email"], input[type="email"]');
  await expect(emailInput).toBeVisible();
  await emailInput.fill('john@example.com');

  // Submit the form
  await page.click('button[type="submit"], button');

  // Wait for success message
  await expect(page.locator('text=Thank you, John Doe')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=john@example.com')).toBeVisible();
});

test('form has required input fields and submit button', async ({ page }) => {
  await page.goto('/');

  // Should have a form element
  await expect(page.locator('form')).toBeVisible();

  // Should have name input
  const nameInput = page.locator('input[name="name"], input[type="text"]').first();
  await expect(nameInput).toBeVisible();

  // Should have email input
  const emailInput = page.locator('input[name="email"], input[type="email"]');
  await expect(emailInput).toBeVisible();

  // Should have submit button
  const submitButton = page.locator('button[type="submit"], button');
  await expect(submitButton).toBeVisible();
});
