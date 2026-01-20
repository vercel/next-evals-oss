import { test, expect } from '@playwright/test';

test('contact form submits and shows success message', async ({ page }) => {
  await page.goto('/');

  // Find the contact form (the one with message field)
  const messageInput = page.locator('textarea[name="message"], input[name="message"]');
  await expect(messageInput).toBeVisible({ timeout: 5000 });

  // Find the form containing the message input (that's the contact form)
  const contactForm = page.locator('form').filter({ has: messageInput });

  // Fill the contact form fields
  await contactForm.locator('input[name="name"]').fill('Alice Smith');
  await contactForm.locator('input[name="email"], input[type="email"]').fill('alice@example.com');
  await messageInput.fill('Hello, this is my message.');

  // Submit the contact form
  await contactForm.locator('button[type="submit"]').click();

  // Wait for success message containing the name and email
  await expect(page.locator('text=Thank you, Alice Smith')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=alice@example.com')).toBeVisible();
});

test('contact form has required input fields', async ({ page }) => {
  await page.goto('/');

  // Find the contact form (the one with message field)
  const messageInput = page.locator('textarea[name="message"], input[name="message"]');
  await expect(messageInput).toBeVisible({ timeout: 5000 });

  // The contact form should have name, email, message inputs and submit button
  const contactForm = page.locator('form').filter({ has: messageInput });

  await expect(contactForm.locator('input[name="name"]')).toBeVisible();
  await expect(contactForm.locator('input[name="email"], input[type="email"]')).toBeVisible();
  await expect(contactForm.locator('button[type="submit"]')).toBeVisible();
});
