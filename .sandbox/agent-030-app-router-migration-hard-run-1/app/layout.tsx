import type { Metadata } from 'next'
import Link from 'next/link'
import { AppProvider } from '@/components/AppProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'My Blog',
  description: 'A complex blog application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProvider>
          <div className="app-container">
            <header>
              <h1>My Blog</h1>
              <nav>
                <Link href="/">Home</Link>
                <Link href="/blog">Blog</Link>
              </nav>
            </header>
            <main>{children}</main>
            <footer>
              <p>&copy; 2024 My Blog</p>
            </footer>
          </div>
        </AppProvider>
      </body>
    </html>
  )
}
