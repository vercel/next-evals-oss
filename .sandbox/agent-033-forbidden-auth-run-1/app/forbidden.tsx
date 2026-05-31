import Link from 'next/link'

export default function Forbidden() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>403 — Forbidden</h1>
      <p>You do not have permission to access this page.</p>
      <Link href="/">Go back home</Link>
    </main>
  )
}
