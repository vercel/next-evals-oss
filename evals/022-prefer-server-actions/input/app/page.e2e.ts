import { test, expect } from '@playwright/test';

test('contact form submits and shows success message', async ({ page }) => {
  await page.goto('/');

  // Find and fill the name input
  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput).toBeVisible();
  await nameInput.fill('Alice Smith');

  // Find and fill the email input
  const emailInput = page.locator('input[name="email"], input[type="email"]');
  await expect(emailInput).toBeVisible();
  await emailInput.fill('alice@example.com');

  // Find and fill the message textarea/input
  const messageInput = page.locator('textarea[name="message"], input[name="message"]');
  await expect(messageInput).toBeVisible();
  await messageInput.fill('Hello, this is my message.');

  // Submit the form
  await page.click('button[type="submit"], button:has-text("Send"), button:has-text("Submit")');

  // Wait for success message containing the name and email
  await expect(page.locator('text=Thank you, Alice Smith')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=alice@example.com')).toBeVisible();
});

test('contact form has required input fields', async ({ page }) => {
  await page.goto('/');

  // Should have a form element (either the existing profile form or the contact form)
  await expect(page.locator('form')).toHaveCount(2);

  // Should have name input for contact form
  const nameInput = page.locator('input[name="name"]');
  await expect(nameInput.first()).toBeVisible();

  // Should have email input for contact form
  const emailInput = page.locator('input[name="email"], input[type="email"]');
  await expect(emailInput.first()).toBeVisible();

  // Should have message input for contact form
  const messageInput = page.locator('textarea[name="message"], input[name="message"]');
  await expect(messageInput).toBeVisible();

  // Should have submit button
  const submitButton = page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Submit")');
  await expect(submitButton.first()).toBeVisible();
});
