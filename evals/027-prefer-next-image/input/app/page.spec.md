# Product Gallery Image Display

## Expected Behavior

1. The ProductGallery component displays images for all three products
2. Each product image is sized at 300x200 pixels
3. All images have descriptive alt text for accessibility
4. Images use the imageUrl from each product's data

## Success Criteria

- Three product images are visible in the gallery
- Images have width="300" and height="200" attributes
- Every image has a non-empty alt attribute
- The image sources correspond to the product imageUrl values (product-1.jpg, product-2.jpg, product-3.jpg)
- Uses Next.js Image component from 'next/image' (following the existing pattern in page.tsx)
- Does not use plain HTML img tags for product images
