import { test, expect } from '@playwright/test';

test('OG image endpoint returns an image', async ({ request }) => {
  // The opengraph-image route should return an image
  const response = await request.get('/opengraph-image');

  expect(response.ok()).toBe(true);

  const contentType = response.headers()['content-type'];
  expect(contentType).toMatch(/^image\//);
});

test('page HTML includes OG image meta tag', async ({ page }) => {
  await page.goto('/');

  // Check that the page has an og:image meta tag pointing to the OG image
  const ogImageMeta = page.locator('meta[property="og:image"]');
  await expect(ogImageMeta).toHaveCount(1);

  const ogImageUrl = await ogImageMeta.getAttribute('content');
  expect(ogImageUrl).toBeTruthy();
  expect(ogImageUrl).toContain('opengraph-image');
});
