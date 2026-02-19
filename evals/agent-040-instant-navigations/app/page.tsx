import Link from 'next/link'

export default function HomePage() {
  return (
    <main>
      <h1>Home</h1>
      <p>Welcome to our store!</p>
      <Link href="/products">Browse Products</Link>
    </main>
  )
}
