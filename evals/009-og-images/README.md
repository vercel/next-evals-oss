# Open Graph Image Generation

## What This Eval Tests

This evaluation tests the ability to create Open Graph images in Next.js App Router using the built-in OG image generation capabilities. This tests understanding of metadata and social media optimization.

## Why This Is Important

**Common LLM Mistakes:**
- **Static image approach**: Using regular images instead of dynamic OG generation
- **Wrong file structure**: Not using the correct file naming conventions
- **Missing ImageResponse**: Not using Next.js OG image generation API
- **Metadata confusion**: Not properly linking OG images to pages

**Real-world Impact:**
Open Graph images are crucial for social media sharing, appearing when links are shared on platforms like Twitter, Facebook, and LinkedIn. Dynamic OG images can include page-specific content and branding.

## How The Test Works

**What Gets Tested:**
- ✅ Creates `opengraph-image.tsx` file or equivalent
- ✅ Uses Next.js ImageResponse API
- ✅ Displays "hello" text as specified
- ✅ Proper OG image dimensions and format
- ✅ Integrates with Next.js metadata system

## Expected Result

```tsx
import { ImageResponse } from 'next/og';

export const alt = 'Hello';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        hello
      </div>
    ),
    { ...size }
  );
}
```

**Success Criteria:**
- OG image file is created with proper naming
- Image displays "hello" text correctly
- Uses Next.js ImageResponse API
- Integrates with page metadata system