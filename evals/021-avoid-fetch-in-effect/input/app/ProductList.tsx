// Example of good server component pattern
export default function ProductList({ products }: { products: any[] }) {
  return (
    <div>
      <h2>Products</h2>
      {products.map((product: any) => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}