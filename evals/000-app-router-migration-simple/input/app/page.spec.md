# Evaluation Criteria

This is a Pages Router to App Router migration. The implementation should migrate the existing pages/index.tsx to the App Router structure.

## Requirements

1. Creates an `app/` directory with the App Router structure
2. Creates `app/layout.tsx` as the root layout with:
   - `export default function` syntax
   - `children` prop that is rendered inside the body
   - `<html>` and `<body>` elements
   - Metadata setup (either via `metadata` export or `<title>` in layout)
3. Creates `app/page.tsx` as the home page with:
   - `export default function` syntax
   - An h1 heading containing "Home"
   - Does NOT import from `next/head` (App Router doesn't use this)
4. The `pages/` directory should be removed or emptied (no page files, only API routes allowed)
5. Uses App Router conventions (no `getServerSideProps`, `getStaticProps`, etc.)
