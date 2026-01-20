import { test, expect } from '@playwright/test';

test('Navigation displays links to blog, products, and support pages', async ({ page }) => {
  await page.goto('/');

  // Check that the Navigation component renders with all required links
  const blogLink = page.getByRole('link', { name: /blog/i });
  const productsLink = page.getByRole('link', { name: /products/i });
  const supportLink = page.getByRole('link', { name: /support/i });

  await expect(blogLink).toBeVisible();
  await expect(productsLink).toBeVisible();
  await expect(supportLink).toBeVisible();
});

test('Navigation links have correct href attributes', async ({ page }) => {
  await page.goto('/');

  // Verify each link points to the correct route
  const blogLink = page.getByRole('link', { name: /blog/i });
  const productsLink = page.getByRole('link', { name: /products/i });
  const supportLink = page.getByRole('link', { name: /support/i });

  await expect(blogLink).toHaveAttribute('href', '/blog');
  await expect(productsLink).toHaveAttribute('href', '/products');
  await expect(supportLink).toHaveAttribute('href', '/support');
});

test('Navigation links are clickable and accessible', async ({ page }) => {
  await page.goto('/');

  // Verify links are in the DOM and accessible
  const blogLink = page.getByRole('link', { name: /blog/i });
  await expect(blogLink).toBeEnabled();
});
