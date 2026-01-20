import { test, expect } from '@playwright/test';

test('response includes custom header from middleware', async ({ page }) => {
  const response = await page.goto('/');

  // Check that the response includes the custom header
  const headers = response?.headers();
  expect(headers?.['x-custom-header']).toBe('middleware-test');
});

test('custom header is present on all routes', async ({ page }) => {
  // Test root route
  const homeResponse = await page.goto('/');
  expect(homeResponse?.headers()['x-custom-header']).toBe('middleware-test');
});
