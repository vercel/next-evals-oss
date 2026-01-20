import { test, expect } from '@playwright/test';

test('page has a button to set cookie', async ({ page }) => {
  await page.goto('/');

  // Find a button with text "Set Cookie"
  const button = page.getByRole('button', { name: /set cookie/i });
  await expect(button).toBeVisible();
});

test('clicking button sets the theme cookie via server action', async ({ page, context }) => {
  await page.goto('/');

  // Click the button
  const button = page.getByRole('button', { name: /set cookie/i });
  await button.click();

  // Wait for the server action to complete
  await page.waitForTimeout(500);

  // Check that the cookie was set
  const cookies = await context.cookies();
  const themeCookie = cookies.find(c => c.name === 'theme');
  expect(themeCookie).toBeDefined();
  expect(themeCookie?.value).toBe('dark');
});
