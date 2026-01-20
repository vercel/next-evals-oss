# Evaluation Criteria

This implementation should use Next.js App Router's draft mode functionality.

## Requirements

1. Page component uses draftMode() from 'next/headers' to check if draft mode is enabled
2. Displays "Draft Mode: ON" in an h1 when draftMode().isEnabled is true
3. Displays "Draft Mode: OFF" in an h1 when draftMode().isEnabled is false
4. Has an API route at app/api/draft/route.ts that enables draft mode
5. The API route uses draftMode().enable() to enable draft mode
6. The API route redirects to '/' after enabling draft mode
7. Uses proper Next.js App Router patterns (route handlers, headers API)
