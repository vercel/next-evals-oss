# Prefer Next.js Image Eval

## What this eval tests
This evaluation tests the ability to use Next.js `Image` component instead of regular HTML `<img>` tags for optimized image loading and display.

## Why it's important
LLMs often struggle with:
- Using regular `<img>` tags instead of Next.js optimized `Image` component
- Understanding the performance benefits of Next.js Image (automatic optimization, lazy loading, responsive images)
- Properly importing and configuring the Image component from `next/image`
- Setting required props like `width`, `height`, and `alt` attributes
- Following Next.js best practices for image optimization and SEO

## How it works
The test validates that:
1. Uses Next.js `Image` component from `next/image` instead of `<img>` tags
2. Proper required props are provided (`src`, `alt`, `width`, `height`)
3. Images are properly sized and optimized
4. Follows existing codebase patterns for image handling
5. Component efficiently displays multiple product images

## Expected result
The implementation should use Next.js Image component:

```typescript
import Image from 'next/image';

interface Product {
  id: number;
  name: string;
  imageUrl: string;
}

interface ProductGalleryProps {
  products: Product[];
}

export default function ProductGallery({ products }: ProductGalleryProps) {
  return (
    <div>
      <h1>Product Gallery</h1>
      <div className="gallery-grid">
        {products.map((product) => (
          <div key={product.id} className="product-item">
            <Image
              src={product.imageUrl}
              alt={product.name}
              width={300}
              height={200}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
            />
            <h3>{product.name}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Instead of using regular img tags:**
```typescript
// Avoid this pattern
export default function ProductGallery({ products }: ProductGalleryProps) {
  return (
    <div>
      <h1>Product Gallery</h1>
      <div className="gallery-grid">
        {products.map((product) => (
          <div key={product.id} className="product-item">
            <img
              src={product.imageUrl}
              alt={product.name}
              width="300"
              height="200"
            />
            <h3>{product.name}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Success criteria
- Uses Next.js `Image` component from `next/image`
- Required props provided: `src`, `alt`, `width`, `height`
- Images sized correctly (300x200 pixels as specified)
- No regular `<img>` tags used for product images
- Follows existing codebase patterns for image optimization