import { getInventory } from '@/lib/data'
import { Suspense } from 'react'

async function LiveInventory() {
  const inventory = await getInventory()

  return (
    <>
      <p>{inventory.count} in stock</p>
      <p>Price: ${inventory.price}</p>
    </>
  )
}

export default function ProductPage() {
  return (
    <main>
      <h1>Premium Widget</h1>
      <Suspense fallback={<p>Loading inventory...</p>}>
        <LiveInventory />
      </Suspense>
    </main>
  )
}
