import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

test('ProductGallery uses Next.js Image component', () => {
  const galleryContent = readFileSync(
    join(process.cwd(), 'app', 'ProductGallery.tsx'),
    'utf-8'
  );

  // Should import Image from next/image
  expect(galleryContent).toMatch(/import.*Image.*from ['"]next\/image['"]/);

  // Should use Image components, not img tags
  expect(galleryContent).toMatch(/<Image/);

  // Should NOT use img tags for product images
  expect(galleryContent).not.toMatch(/<img/);
});

test('ProductGallery has required image props', () => {
  const galleryContent = readFileSync(
    join(process.cwd(), 'app', 'ProductGallery.tsx'),
    'utf-8'
  );

  // Should have width and height props
  expect(galleryContent).toMatch(/width\s*=/);
  expect(galleryContent).toMatch(/height\s*=/);

  // Should have src prop using product imageUrl
  expect(galleryContent).toMatch(
    /src.*=.*product\.imageUrl|src.*=.*\{product\.imageUrl\}/
  );

  // Should have alt prop
  expect(galleryContent).toMatch(/alt.*=/);
});
