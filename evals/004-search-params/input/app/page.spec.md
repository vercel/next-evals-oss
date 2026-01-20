# Evaluation Criteria

This page should read URL search params and pass them to a client component.

## Requirements

1. Page component is a server component (no 'use client' directive)
2. Page component is async and awaits searchParams (Next.js v15 pattern)
3. Imports and renders the Client component
4. Passes the "name" search param to Client as a prop
5. Has proper TypeScript types for the searchParams prop
