# BlogHeader Custom Font Styling

## Expected Behavior

1. The BlogHeader component displays a heading with the Playfair Display font
2. The BlogHeader component displays a subtitle with the Roboto font
3. The fonts are loaded using Next.js font optimization (next/font/google)
4. Each text element has distinct font styling applied via className

## Success Criteria

- The heading "My Personal Blog" is visible and uses Playfair Display font
- The subtitle "Thoughts, ideas, and musings" is visible and uses Roboto font
- Fonts are imported from 'next/font/google' for performance optimization
- Font instances are created with proper configuration (including 'latin' subset)
- Font classes are applied to elements using the .className property
- No external CSS @import or font-family inline styles are used for loading fonts
