import type { Metadata } from 'next'
import { ViewTransitions } from 'next/view-transitions'
import './globals.css'

export const metadata: Metadata = {
  title: 'Product Gallery',
  description: 'A simple product gallery',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <ViewTransitions>{children}</ViewTransitions>
      </body>
    </html>
  )
}
