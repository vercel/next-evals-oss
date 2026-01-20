I want to migrate my existing Next.js Pages Router application to the App Router.

The application is a blog platform with:
- A homepage that shows recent posts fetched server-side
- A blog index page listing all posts with ISR (60 second revalidation)
- Individual blog post pages with comments (statically generated with 5 minute revalidation)
- API endpoints for posts CRUD operations

I need the migrated application to:
- Use the App Router file structure with the `app/` directory
- Replace `getServerSideProps`, `getStaticProps`, and `getStaticPaths` with modern data fetching patterns
- Convert API routes to Route Handlers
- Use the Metadata API instead of `next/head`
- Implement proper error handling with `error.tsx` and `not-found.tsx`
- Remove the `pages/` directory completely when migration is complete

The application should maintain all existing functionality after migration.
