import { getInventory } from '@/lib/data'

export default async function ProductPage() {
  const inventory = await getInventory()

  return (
    <>
      <p>{inventory.count} in stock</p>
      <p>Price: ${inventory.price}</p>
    </>
  )
}
