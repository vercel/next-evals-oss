import { test, expect } from '@playwright/test';

test('page has navigation links', async ({ page }) => {
  await page.goto('/');

  // Should have a link to /about
  const aboutLink = page.locator('a[href="/about"]');
  await expect(aboutLink).toBeVisible();

  // Should have a link to /contact
  const contactLink = page.locator('a[href="/contact"]');
  await expect(contactLink).toBeVisible();
});

test('about link navigates correctly', async ({ page }) => {
  await page.goto('/');

  // Click the about link
  await page.click('a[href="/about"]');

  // Should navigate to /about
  await expect(page).toHaveURL('/about');
});

test('contact link navigates correctly', async ({ page }) => {
  await page.goto('/');

  // Click the contact link
  await page.click('a[href="/contact"]');

  // Should navigate to /contact
  await expect(page).toHaveURL('/contact');
});
