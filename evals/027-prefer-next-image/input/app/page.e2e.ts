import { test, expect } from '@playwright/test';

test('ProductGallery displays images for all products', async ({ page }) => {
  await page.goto('/');

  // Should have images in the product gallery section
  const productImages = page.locator('section img, [class*="gallery"] img, [class*="product"] img');

  // We expect 3 product images based on the product data
  await expect(productImages).toHaveCount(3);
});

test('product images have correct dimensions', async ({ page }) => {
  await page.goto('/');

  // Get all product images (excluding hero image which is 800x400)
  const images = page.locator('img');
  const count = await images.count();

  let productImageCount = 0;
  for (let i = 0; i < count; i++) {
    const img = images.nth(i);
    const width = await img.getAttribute('width');
    const height = await img.getAttribute('height');

    // Check for 300x200 product images
    if (width === '300' && height === '200') {
      productImageCount++;
    }
  }

  // Should have 3 product images with 300x200 dimensions
  expect(productImageCount).toBe(3);
});

test('product images have alt text', async ({ page }) => {
  await page.goto('/');

  // Get all images
  const images = page.locator('img');
  const count = await images.count();

  for (let i = 0; i < count; i++) {
    const img = images.nth(i);
    const alt = await img.getAttribute('alt');

    // Every image should have alt text
    expect(alt).toBeTruthy();
    expect(alt!.trim().length).toBeGreaterThan(0);
  }
});

test('product images use correct source URLs', async ({ page }) => {
  await page.goto('/');

  // Check that product image URLs are present (Next.js Image may transform src)
  const imgSources = await page.locator('img').evaluateAll((imgs) =>
    imgs.map((img) => img.getAttribute('src') || '')
  );

  // Should have sources containing product image paths
  const productSources = imgSources.filter(
    (src) => src.includes('product-1') || src.includes('product-2') || src.includes('product-3')
  );
  expect(productSources.length).toBe(3);
});
