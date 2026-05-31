import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Home Page',
  description: 'Welcome to our Next.js app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
