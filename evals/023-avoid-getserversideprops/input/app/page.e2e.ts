import { test, expect } from '@playwright/test';

test('UserDashboard displays user preferences', async ({ page }) => {
  await page.goto('/');

  // The dashboard should be visible
  const dashboard = page.locator('text=User Dashboard');
  await expect(dashboard).toBeVisible();

  // Should display user preferences content (theme, notifications, or language)
  const content = await page.textContent('body');
  // The preferences should be displayed somewhere on the page
  expect(
    content?.includes('theme') ||
    content?.includes('Theme') ||
    content?.includes('preferences') ||
    content?.includes('Preferences') ||
    content?.includes('notification') ||
    content?.includes('Notification')
  ).toBeTruthy();
});

test('page renders without client-side hydration errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('/');
  await page.waitForTimeout(1000);

  // Filter out non-critical errors (like network errors from mock API)
  const criticalErrors = errors.filter(
    (e) => e.includes('Hydration') || e.includes('hydration')
  );
  expect(criticalErrors).toHaveLength(0);
});

test('dashboard content is server-rendered', async ({ page }) => {
  // Disable JavaScript to verify content is server-rendered
  await page.context().route('**/*', (route) => {
    if (route.request().resourceType() === 'script') {
      route.abort();
    } else {
      route.continue();
    }
  });

  await page.goto('/');

  // The dashboard heading should still be visible without JavaScript
  const dashboard = page.locator('text=User Dashboard');
  await expect(dashboard).toBeVisible();
});
