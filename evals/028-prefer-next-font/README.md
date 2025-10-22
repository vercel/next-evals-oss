# Prefer Next.js Font Eval

## What this eval tests
This evaluation tests the ability to use Next.js font optimization with `next/font` instead of external font loading methods like Google Fonts CDN or CSS imports.

## Why it's important
LLMs often struggle with:
- Using external font CDN links instead of Next.js optimized font loading
- Understanding the performance benefits of `next/font` (self-hosting, zero layout shift, privacy)
- Properly importing and configuring fonts from `next/font/google`
- Applying font classes correctly to components
- Setting up multiple fonts with proper fallbacks and configurations

## How it works
The test validates that:
1. Fonts are imported from `next/font/google` instead of external CDN
2. Font configurations include proper options (subsets, weights, display, etc.)
3. Font classes are applied correctly to HTML elements
4. Multiple fonts are configured and used appropriately
5. No external font links or CSS imports are used

## Expected result
The implementation should use Next.js font optimization:

```typescript
import { Playfair_Display, Roboto } from 'next/font/google';

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
});

export default function BlogHeader() {
  return (
    <header>
      <h1 className={playfairDisplay.className}>
        Welcome to Our Blog
      </h1>
      <p className={roboto.className}>
        Discover amazing stories and insights
      </p>
    </header>
  );
}
```

**Instead of external font loading:**
```typescript
// Avoid this pattern
import Head from 'next/head';

export default function BlogHeader() {
  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Roboto:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </Head>
      <header>
        <h1 style={{ fontFamily: 'Playfair Display, serif' }}>
          Welcome to Our Blog
        </h1>
        <p style={{ fontFamily: 'Roboto, sans-serif' }}>
          Discover amazing stories and insights
        </p>
      </header>
    </>
  );
}
```

**Or CSS import pattern:**
```css
/* Avoid this in CSS files */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Roboto:wght@300;400;500&display=swap');
```

## Success criteria
- Fonts imported from `next/font/google`
- Proper font configurations with subsets, weights, and display options
- Font classes applied correctly to HTML elements
- Multiple fonts (Playfair Display and Roboto) properly configured
- No external font CDN links or CSS imports used