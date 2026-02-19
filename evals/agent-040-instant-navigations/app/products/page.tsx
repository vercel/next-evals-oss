import { cookies } from 'next/headers'
import { getProducts } from '@/lib/data'

export default async function ProductsPage() {
  const products = await getProducts()
  const cookieStore = await cookies()
  const username = cookieStore.get('username')?.value ?? 'Guest'

  return (
    <main>
      <h1>Product Catalog</h1>
      <ul>
        {products.map((p) => (
          <li key={p.id}>{p.name} - ${p.price}</li>
        ))}
      </ul>
      <footer>
        <p>Welcome, {username}</p>
      </footer>
    </main>
  )
}
