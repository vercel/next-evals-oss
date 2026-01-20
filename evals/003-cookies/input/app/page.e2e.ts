import { test, expect } from '@playwright/test';

test('form sets username cookie on submit', async ({ page, context }) => {
  await page.goto('/');

  // Find the username input and fill it
  const usernameInput = page.locator('input[name="username"], input[type="text"]').first();
  await expect(usernameInput).toBeVisible();
  await usernameInput.fill('testuser');

  // Submit the form
  await page.click('button[type="submit"], button');

  // Wait for the form submission to complete
  await page.waitForTimeout(500);

  // Check that the cookie was set
  const cookies = await context.cookies();
  const userCookie = cookies.find(c => c.name === 'user');
  expect(userCookie).toBeDefined();
  expect(userCookie?.value).toBe('testuser');
});
