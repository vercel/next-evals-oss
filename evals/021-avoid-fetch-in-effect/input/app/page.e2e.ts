import { test, expect } from '@playwright/test';

test('displays user profile with name and email', async ({ page }) => {
  await page.goto('/');

  // The page should display user profile information
  // Check for name and email content (server-rendered, no loading state)
  const bodyText = await page.textContent('body');

  // Should contain user name
  expect(bodyText).toMatch(/name/i);

  // Should contain user email
  expect(bodyText).toMatch(/email/i);
});

test('user profile section is visible on dashboard', async ({ page }) => {
  await page.goto('/');

  // Dashboard heading should be visible
  await expect(page.locator('h1')).toContainText('Dashboard');

  // User profile content should be present (not a "not implemented" message)
  const content = await page.textContent('body');
  expect(content).not.toContain('not implemented');
});

test('page renders without client-side loading state', async ({ page }) => {
  // Disable JavaScript to verify server-side rendering
  await page.context().route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') {
      await route.abort();
    } else {
      await route.continue();
    }
  });

  await page.goto('/');

  // Content should be visible even without JavaScript (server-rendered)
  const bodyText = await page.textContent('body');
  expect(bodyText).toMatch(/name/i);
  expect(bodyText).toMatch(/email/i);
});
