# Route Groups Evaluation

## Expected Behavior

1. The app uses Next.js route groups to organize routes without affecting URL structure
2. A marketing route group contains the about page
3. A shop route group contains the products page
4. The about page is accessible at /about and displays "About Us" in an h1
5. The products page is accessible at /products and displays "Our Products" in an h1

## Success Criteria

- Route group folders use the parentheses convention: `(marketing)` and `(shop)`
- The about page exists at `app/(marketing)/about/page.tsx`
- The products page exists at `app/(shop)/products/page.tsx`
- Both pages render their respective h1 headings
- The route group names do not appear in the URL paths
