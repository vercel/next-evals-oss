import { test, expect, BrowserContextOptions } from '@playwright/test';

const userAgents = {
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0',
  chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
};

test.describe('Browser detection', () => {
  test('shows unsupported message for Safari users', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: userAgents.safari });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('text=/unsupported browser/i')).toBeVisible();
    await context.close();
  });

  test('shows unsupported message for Firefox users', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: userAgents.firefox });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('text=/unsupported browser/i')).toBeVisible();
    await context.close();
  });

  test('shows welcome message for Chrome users', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: userAgents.chrome });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('text=/welcome/i')).toBeVisible();
    await expect(page.locator('text=/unsupported browser/i')).not.toBeVisible();
    await context.close();
  });

  test('shows welcome message for Edge users', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: userAgents.edge });
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('text=/welcome/i')).toBeVisible();
    await expect(page.locator('text=/unsupported browser/i')).not.toBeVisible();
    await context.close();
  });

  test('page loads without errors (SSR safety)', async ({ page }) => {
    // Default test - page should load without crashing
    await page.goto('/');
    // Page should render something (either welcome or unsupported, depending on test browser)
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
