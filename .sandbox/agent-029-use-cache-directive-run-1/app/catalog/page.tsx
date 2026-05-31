import { getAllProducts } from '@/lib/db'
import { cacheTag, revalidateTag } from 'next/cache'

async function getCachedProducts() {
  'use cache'
  cacheTag('products')
  return getAllProducts()
}

export default async function CatalogPage() {
  const products = await getCachedProducts()

  async function syncCatalog() {
    'use server'
    revalidateTag('products', 'default')
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1>Product Catalog</h1>
      <form action={syncCatalog} style={{ marginBottom: '1rem' }}>
        <button type="submit">Sync latest catalog</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product: any) => (
            <tr key={product.id}>
              <td>{product.id}</td>
              <td>{product.name}</td>
              <td>${product.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
