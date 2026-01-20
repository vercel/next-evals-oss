import { test, expect } from '@playwright/test';

test('displays error message when page throws', async ({ page }) => {
  await page.goto('/');

  // The error boundary should catch the error and display the error message
  const heading = page.locator('h1');
  await expect(heading).toContainText('Something went wrong!');
});

test('has a Try again button', async ({ page }) => {
  await page.goto('/');

  // Should have a button to retry
  const button = page.locator('button');
  await expect(button).toBeVisible();
  await expect(button).toContainText('Try again');
});

test('Try again button is clickable', async ({ page }) => {
  await page.goto('/');

  // The button should be clickable (calls reset function)
  const button = page.locator('button');
  await expect(button).toBeEnabled();

  // Click should not cause unhandled errors (it will re-render and show error again)
  await button.click();

  // After clicking, the error UI should still be visible (since the error will throw again)
  await expect(page.locator('h1')).toContainText('Something went wrong!');
});
