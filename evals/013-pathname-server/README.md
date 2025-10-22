# Pathname Server Component Eval

## What this eval tests
This evaluation tests the ability to create a server component that uses URL pathname parameters to fetch data from an API, demonstrating dynamic routing and server-side data fetching patterns.

## Why it's important
LLMs often struggle with:
- Understanding how to access URL parameters in App Router server components
- Using the `params` prop correctly in dynamic route segments
- Distinguishing between server-side data fetching and client-side patterns
- Creating proper dynamic route file structure (`[id]/page.tsx`)
- Handling async server components and data fetching
- Understanding when to use server components vs client components for data fetching

## How it works
The test validates that:
1. A dynamic route is created using `[id]` or similar bracket notation
2. The server component accepts and uses the `params` prop
3. The component fetches data server-side using the pathname parameter
4. Data is rendered directly in the server component without client-side effects
5. The component handles the async nature of data fetching properly

## Expected result
The implementation should create a dynamic route structure:

```
app/
├── product/
│   └── [id]/
│       └── page.tsx
```

With page.tsx:
```typescript
async function getProduct(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`);
  if (!res.ok) throw new Error('Failed to fetch product');
  return res.json();
}

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id);
  
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p>Price: ${product.price}</p>
    </div>
  );
}
```

## Success criteria
- Dynamic route created with proper bracket notation (`[id]`, `[slug]`, etc.)
- Server component is async and uses `params` prop correctly
- Data fetching happens server-side using the pathname parameter
- Component renders fetched data without client-side state management
- No use of `useEffect`, `useState`, or other client-side hooks