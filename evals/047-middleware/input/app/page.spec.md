# Evaluation Criteria

This implementation should add Next.js middleware that modifies response headers.

## Requirements

1. Creates a middleware.ts file in the root of the input directory (not in app/)
2. Uses NextResponse from 'next/server' to modify response headers
3. Adds custom header "X-Custom-Header" with value "middleware-test"
4. The middleware runs on all routes (no specific matcher config, or a matcher that includes '/')
5. Uses proper middleware export (export function middleware or export default)
