export default function ProductLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main>
      <h1>Premium Widget</h1>
      {children}
    </main>
  )
}
