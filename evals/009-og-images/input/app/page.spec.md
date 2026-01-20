# Open Graph Image Evaluation Criteria

## Requirements

1. **OG Image File Exists**: There should be an `opengraph-image.tsx` or `opengraph-image.js` file in the app directory that generates the Open Graph image.

2. **Uses ImageResponse API**: The OG image file should use Next.js's `ImageResponse` API from `next/og` to generate the image dynamically.

3. **Displays "hello" Text**: The generated image should contain the text "hello" (case-insensitive).

4. **Valid Image Response**: When the `/opengraph-image` route is accessed, it should return a valid image with an appropriate content-type header (e.g., `image/png`).

5. **Meta Tag Integration**: The page should automatically have an `og:image` meta tag that references the generated Open Graph image.
