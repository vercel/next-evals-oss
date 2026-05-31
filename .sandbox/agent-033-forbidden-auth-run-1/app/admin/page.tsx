import { forbidden } from 'next/navigation'
import { verifyAdmin } from '../lib/auth'

export default async function AdminPage() {
  const { isAdmin } = await verifyAdmin()

  if (!isAdmin) {
    forbidden()
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Admin Dashboard</h1>
      <p>Welcome, admin.</p>
    </main>
  )
}
