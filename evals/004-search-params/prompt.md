Create a server component <Page> which reads the URL search parameter "name" from the incoming request and forwards it to a client component <Client>. Requirements:
- Use Next.js App Router v15
- Component must be async and await searchParams (Promise in v15)
- Include proper TypeScript types for searchParams Promise
- Import and render <Client> component with name prop
- Extract name parameter from searchParams and pass to Client
