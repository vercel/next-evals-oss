import Link from 'next/link'

export default function Navigation() {
  return (
    <div>
      <h2>More Pages</h2>
      <nav>
        <Link href="/blog">Blog</Link>
        <Link href="/products">Products</Link>
        <Link href="/support">Support</Link>
      </nav>
    </div>
  )
}
