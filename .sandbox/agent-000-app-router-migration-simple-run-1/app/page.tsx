import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Home Page',
  description: 'Welcome to our Next.js app',
}

export default function Home() {
  return (
    <main>
      <h1>Home</h1>
      <p>Welcome to our Next.js application!</p>
      <nav>
        <ul>
          <li>
            <a href="/about">About</a>
          </li>
          <li>
            <a href="/contact">Contact</a>
          </li>
        </ul>
      </nav>
    </main>
  )
}
