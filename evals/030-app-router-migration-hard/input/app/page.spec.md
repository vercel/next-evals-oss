# App Router Migration Specification

## Expected Behavior

The application should be fully migrated from Next.js Pages Router to App Router while maintaining all existing functionality.

## File Structure Requirements

1. The `pages/` directory should be removed completely
2. The `app/` directory should contain:
   - `layout.tsx` - Root layout with html/body tags, header, footer, and provider
   - `page.tsx` - Homepage with server-side data fetching
   - `error.tsx` - Error boundary component (must be a client component)
   - `not-found.tsx` - Custom 404 page
   - `blog/page.tsx` - Blog index with ISR
   - `blog/[id]/page.tsx` - Dynamic blog post pages with generateStaticParams
   - `api/posts/route.ts` - Route handler for posts collection
   - `api/posts/[id]/route.ts` - Route handler for individual posts

## Homepage (/app/page.tsx)

- Must be an async Server Component (no 'use client' directive)
- Fetches posts from the API server-side using fetch
- Does NOT use getServerSideProps
- Exports metadata object or uses generateMetadata for SEO
- Does NOT import from 'next/head'

## Blog Index (/app/blog/page.tsx)

- Must be an async Server Component
- Implements ISR via revalidate option (e.g., `export const revalidate = 60`)
- Does NOT use getStaticProps
- Exports metadata for SEO

## Blog Post Detail (/app/blog/[id]/page.tsx)

- Must be an async Server Component
- Exports generateStaticParams function to pre-render pages
- Does NOT use getStaticPaths or getStaticProps
- Displays post content and comments
- Has proper metadata using generateMetadata

## API Routes

- `/api/posts/route.ts` exports GET and POST functions
- `/api/posts/[id]/route.ts` exports GET, PUT, and DELETE functions
- Uses Request/Response or NextRequest/NextResponse APIs
- Does NOT use the old req/res handler pattern

## Root Layout (/app/layout.tsx)

- Contains html and body tags with lang attribute
- Wraps content with AppProvider
- Includes header with navigation (Home, Blog links)
- Includes footer
- Accepts children prop with proper TypeScript types
- Has metadata export for global SEO

## Error Handling

- `error.tsx` must have 'use client' directive (error boundaries must be client components)
- `error.tsx` receives error and reset props
- `not-found.tsx` displays 404 content

## Client Components

- Any component using hooks like useRouter must be a Client Component with 'use client'
- useRouter must be imported from 'next/navigation', NOT 'next/router'
- Interactive elements (buttons with onClick) should be in Client Components or use client-side patterns

## Success Criteria

- All routes are accessible and return 200 status
- Homepage displays posts fetched server-side
- Blog index shows all posts with working navigation
- Individual blog posts display with comments
- API endpoints respond correctly to all HTTP methods
- 404 page appears for non-existent routes
- Layout includes header, footer, and proper navigation
- No references to Pages Router APIs remain in the codebase
