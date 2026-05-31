import { cookies, headers } from 'next/headers'

export default async function Home() {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value ?? 'light'

  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language') ?? 'Not provided'

  return (
    <main>
      <h1>User Preferences</h1>
      <section>
        <h2>Theme</h2>
        <p>{theme}</p>
      </section>
      <section>
        <h2>Language</h2>
        <p>{acceptLanguage}</p>
      </section>
    </main>
  )
}
