# Blog Post Static Generation

## Expected Behavior

1. The page at /blog/1 displays "Blog Post 1" in an h1 heading
2. The blog post page is pre-rendered at build time for id "1"
3. The dynamic route segment [id] is properly configured

## Success Criteria

- The page exports a `generateStaticParams` function
- The `generateStaticParams` function returns an array containing `{ id: '1' }`
- The page component renders an h1 with "Blog Post {id}" where {id} is the dynamic segment
- The page does NOT use 'use client' directive (it should be a server component)
- The page does NOT use the old Pages Router `getStaticPaths` API
