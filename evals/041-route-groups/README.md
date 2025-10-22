# Route Groups

## What This Eval Tests

This evaluation tests the ability to implement route groups in Next.js App Router. Route groups allow organizing routes without affecting URL structure using the (folder) convention.

## Why This Is Important

**Common LLM Mistakes:**
- **Missing parentheses**: Not using () for route group folders
- **URL confusion**: Thinking route groups affect the URL path
- **Wrong folder structure**: Placing pages incorrectly within groups
- **Layout confusion**: Not understanding group-specific layouts
- **Naming issues**: Using route groups in URLs

**Real-world Impact:**
Route groups enable:
- Logical organization of related routes
- Multiple root layouts for different app sections
- Clean URLs without organizational folder names
- Better code organization in large applications

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Creates (marketing) route group
- ✅ Creates (shop) route group
- ✅ Pages accessible at correct URLs
- ✅ Route groups don't affect URL structure
- ✅ Correct content in each page

## Expected Result

**app/(marketing)/about/page.tsx:**
```tsx
export default function AboutPage() {
  return <h1>About Us</h1>;
}
```

**app/(shop)/products/page.tsx:**
```tsx
export default function ProductsPage() {
  return <h1>Our Products</h1>;
}
```

**Key Patterns Validated:**
- **Route Group Convention**: Uses () for groups
- **URL Independence**: Groups don't appear in URLs
- **Folder Organization**: Correct page placement
- **Content Rendering**: Proper h1 tags with content

**Success Criteria:**
- Route groups created with parentheses
- Pages accessible at /about and /products
- Correct content displayed
- No route group names in URLs