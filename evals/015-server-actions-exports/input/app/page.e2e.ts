import { test, expect } from '@playwright/test';

test.describe('Server Actions', () => {
  test('should display a form with a submit button', async ({ page }) => {
    await page.goto('/');

    // Should have a form element
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Should have a submit button
    const submitButton = page.locator('button[type="submit"], input[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('should increment counter when form is submitted', async ({ page }) => {
    await page.goto('/');

    // Get initial counter value
    const counterElement = page.locator('[data-testid="counter"], .counter, #counter').first();
    const initialText = await counterElement.textContent();
    const initialValue = parseInt(initialText?.match(/\d+/)?.[0] || '0', 10);

    // Submit the form
    const submitButton = page.locator('button[type="submit"], input[type="submit"]');
    await submitButton.click();

    // Wait for the page to update (server action completes)
    await page.waitForLoadState('networkidle');

    // Counter should have incremented
    const newText = await counterElement.textContent();
    const newValue = parseInt(newText?.match(/\d+/)?.[0] || '0', 10);
    expect(newValue).toBeGreaterThan(initialValue);
  });

  test('should handle multiple form submissions', async ({ page }) => {
    await page.goto('/');

    const submitButton = page.locator('button[type="submit"], input[type="submit"]');
    const counterElement = page.locator('[data-testid="counter"], .counter, #counter').first();

    // Submit the form multiple times
    await submitButton.click();
    await page.waitForLoadState('networkidle');

    await submitButton.click();
    await page.waitForLoadState('networkidle');

    // Counter should have incremented at least twice
    const finalText = await counterElement.textContent();
    const finalValue = parseInt(finalText?.match(/\d+/)?.[0] || '0', 10);
    expect(finalValue).toBeGreaterThanOrEqual(2);
  });
});
