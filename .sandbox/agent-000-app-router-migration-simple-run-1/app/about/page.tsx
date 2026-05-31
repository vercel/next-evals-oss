import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn more about us',
}

export default function About() {
  return (
    <main>
      <h1>About</h1>
      <p>This is the about page of our Next.js application.</p>
      <nav>
        <ul>
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a href="/contact">Contact</a>
          </li>
        </ul>
      </nav>
    </main>
  )
}
