import { connection } from 'next/server'

export async function getProducts() {
  await connection()
  return [
    { id: 1, name: 'Laptop', price: 999 },
    { id: 2, name: 'Phone', price: 699 },
    { id: 3, name: 'Tablet', price: 499 },
    { id: 4, name: 'Headphones', price: 199 },
    { id: 5, name: 'Watch', price: 299 },
  ]
}
