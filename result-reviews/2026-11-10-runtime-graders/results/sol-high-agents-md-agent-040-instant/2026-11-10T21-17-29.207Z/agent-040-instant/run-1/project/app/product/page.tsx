import { Suspense } from 'react'
import { getInventory } from '@/lib/data'

export default function ProductPage() {
  return (
    <main>
      <h1>Premium Widget</h1>
      <Suspense fallback={<p>Loading inventory...</p>}>
        <Inventory />
      </Suspense>
    </main>
  )
}

async function Inventory() {
  const inventory = await getInventory()

  return (
    <>
      <p>{inventory.count} in stock</p>
      <p>Price: ${inventory.price}</p>
    </>
  )
}
