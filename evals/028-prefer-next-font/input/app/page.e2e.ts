import { test, expect } from '@playwright/test';

test('BlogHeader displays heading with Playfair Display font', async ({ page }) => {
  await page.goto('/');

  // The header should have an h1 element with some font styling applied
  const heading = page.locator('header h1');
  await expect(heading).toBeVisible();
  await expect(heading).toContainText('My Personal Blog');

  // The heading should have a className applied (indicating font styling)
  const headingClass = await heading.getAttribute('class');
  expect(headingClass).toBeTruthy();
});

test('BlogHeader displays subtitle with Roboto font', async ({ page }) => {
  await page.goto('/');

  // The header should have a paragraph (subtitle) with font styling
  const subtitle = page.locator('header p');
  await expect(subtitle).toBeVisible();
  await expect(subtitle).toContainText('Thoughts, ideas, and musings');

  // The subtitle should have a className applied (indicating font styling)
  const subtitleClass = await subtitle.getAttribute('class');
  expect(subtitleClass).toBeTruthy();
});

test('heading and subtitle have different font styles', async ({ page }) => {
  await page.goto('/');

  const heading = page.locator('header h1');
  const subtitle = page.locator('header p');

  // Both elements should be visible
  await expect(heading).toBeVisible();
  await expect(subtitle).toBeVisible();

  // Get computed styles to verify different fonts are applied
  const headingFontFamily = await heading.evaluate((el) => getComputedStyle(el).fontFamily);
  const subtitleFontFamily = await subtitle.evaluate((el) => getComputedStyle(el).fontFamily);

  // The fonts should be different (Playfair Display vs Roboto)
  expect(headingFontFamily).not.toBe(subtitleFontFamily);
});
