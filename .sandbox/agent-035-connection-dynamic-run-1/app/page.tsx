export const dynamic = 'force-dynamic'

export default function Home() {
  const timestamp = new Date().toISOString()

  return (
    <main>
      <h1>Server Timestamp</h1>
      <p>{timestamp}</p>
    </main>
  )
}
