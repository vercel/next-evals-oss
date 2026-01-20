import { test, expect } from '@playwright/test';

test('displays name from URL search params', async ({ page }) => {
  await page.goto('/?name=Alice');

  // Should display the name in the Client component
  await expect(page.locator('[data-testid="client"]')).toContainText('Alice');
});

test('handles different names', async ({ page }) => {
  await page.goto('/?name=Bob');

  await expect(page.locator('[data-testid="client"]')).toContainText('Bob');
});
