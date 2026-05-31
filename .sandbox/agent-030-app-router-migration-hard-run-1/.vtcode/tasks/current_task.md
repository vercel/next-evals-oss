# Migrate Pages Router to App Router

- [ ] Create app/ directory structure and root layout
  files: app/layout.tsx, app/globals.css
- [ ] Migrate home page (getServerSideProps -> async page component with headers())
  files: app/page.tsx
- [ ] Migrate blog index (getStaticProps -> async page component)
  files: app/blog/page.tsx
- [ ] Migrate blog post detail (getStaticPaths + getStaticProps -> async page component with generateStaticParams)
  files: app/blog/[id]/page.tsx
- [ ] Migrate API routes to Route Handlers (GET/POST/PUT/DELETE)
  files: app/api/posts/route.ts, app/api/posts/[id]/route.ts
- [ ] Migrate 404 page to not-found.tsx
  files: app/not-found.tsx
- [ ] Migrate _error.js to error.tsx
  files: app/error.tsx
- [ ] Convert AppProvider component to TypeScript with types
  files: components/AppProvider.tsx
- [ ] Delete pages/ directory after verifying app/ works
