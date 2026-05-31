import { after } from 'next/server'
import { logPageView } from './analytics'

export default function Home() {
  after(async () => {
    await logPageView('/')
  })

  return (
    <main>
      <h1>Welcome</h1>
      <p>Your visit has been logged.</p>
    </main>
  )
}
