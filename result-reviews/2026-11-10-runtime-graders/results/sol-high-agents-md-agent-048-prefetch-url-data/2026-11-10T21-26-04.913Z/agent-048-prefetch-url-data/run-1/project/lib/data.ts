import { cacheLife } from 'next/cache'

const productsByCategory: Record<string, string[]> = {
  featured: ['Desk Lamp', 'Wool Blanket'],
  sale: ['Canvas Tote', 'Travel Mug'],
}

export async function getProducts(category: string) {
  'use cache'
  cacheLife('hours')

  await new Promise((resolve) => setTimeout(resolve, 800))
  return productsByCategory[category] ?? []
}
