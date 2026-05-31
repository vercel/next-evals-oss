import { Playfair_Display, Roboto } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
})

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-roboto',
})

export default function BlogHeader() {
  return (
    <header className={`${playfair.variable} ${roboto.variable}`}>
      <h1 style={{ fontFamily: 'var(--font-playfair), serif' }}>
        My Personal Blog
      </h1>
      <p style={{ fontFamily: 'var(--font-roboto), sans-serif' }}>
        Thoughts, ideas, and musings
      </p>
    </header>
  )
}
