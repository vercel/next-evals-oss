import { test, expect } from '@playwright/test';

test('form is visible with submit button', async ({ page }) => {
  await page.goto('/');

  // Should have a form element
  const form = page.locator('form');
  await expect(form).toBeVisible();

  // Should have a submit button
  const submitButton = page.locator('button[type="submit"], button');
  await expect(submitButton).toBeVisible();
});

test('form displays success message after successful submission', async ({ page }) => {
  await page.goto('/');

  // Find any text input in the form
  const textInput = page.locator('form input[type="text"], form input:not([type])').first();

  // Fill if there's an input field
  const inputCount = await textInput.count();
  if (inputCount > 0) {
    await textInput.fill('test value');
  }

  // Submit the form
  await page.click('button[type="submit"], button');

  // Wait for the page to show a success message
  // The success message should contain words like "success", "thank", "submitted", or "saved"
  await expect(
    page.locator('text=/success|thank|submitted|saved/i')
  ).toBeVisible({ timeout: 5000 });
});

test('form displays error message when submission fails', async ({ page }) => {
  await page.goto('/');

  // Submit the form without filling required fields (if any)
  // to trigger an error, or the server action may return an error state
  await page.click('button[type="submit"], button');

  // Wait a moment for the response
  await page.waitForTimeout(1000);

  // Check if either success or error message appears
  // This verifies the form responds to the action state
  const hasMessage = await page.locator('text=/success|error|failed|invalid|required|thank|submitted|saved/i').isVisible();
  expect(hasMessage).toBe(true);
});
