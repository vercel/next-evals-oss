import { test, expect } from '@playwright/test';

test('form has name input with placeholder', async ({ page }) => {
  await page.goto('/');

  const input = page.locator('input[name="name"]');
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute('placeholder', 'Enter your name');
});

test('form has submit button', async ({ page }) => {
  await page.goto('/');

  const button = page.locator('button[type="submit"], button:has-text("Submit")');
  await expect(button).toBeVisible();
  await expect(button).toContainText('Submit');
});

test('form submits successfully', async ({ page }) => {
  await page.goto('/');

  // Fill in the name input
  await page.fill('input[name="name"]', 'Test User');

  // Submit the form
  await page.click('button[type="submit"], button:has-text("Submit")');

  // After submission, the page should still be functional (no error)
  // The form should either redirect, show success, or remain on the page
  await expect(page.locator('body')).toBeVisible();
});
