I have a React Server Component like this:

function Page () {
  const data = getData(); // promise
  return <ClientComponent data={data} />
}

Write a Client Component that uses React's `use()` hook to consume the `data` prop (a Promise). Requirements:
- Create ClientComponent.tsx with 'use client' directive
- Import { use } from 'react'
- Use use(data) to unwrap the Promise
- Render the result in a <div> using JSON.stringify()
- Update Page component to wrap ClientComponent in <Suspense> when passing the promise
