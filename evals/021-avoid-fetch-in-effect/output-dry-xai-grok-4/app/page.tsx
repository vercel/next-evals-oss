import ProductList from './ProductList';
import UserProfile from './UserProfile';

// Example of existing server component with data fetching
async function getProducts() {
  const res = await fetch('https://api.example.com/products');
  return res.json();
}

export default async function Page() {
  const products = await getProducts();
  
  return (
    <div>
      <h1>Dashboard</h1>
      <ProductList products={products} />
      <UserProfile />
    </div>
  );
}
