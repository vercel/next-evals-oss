# Middleware

## What This Eval Tests

This evaluation tests the ability to implement Next.js middleware for request/response manipulation at the edge runtime.

## Why This Is Important

**Common LLM Mistakes:**
- **Wrong file location**: Placing middleware.ts in wrong directory
- **Missing NextResponse import**: Not importing from next/server
- **No config export**: Forgetting matcher configuration
- **Wrong response handling**: Not using NextResponse.next()
- **Incorrect header syntax**: Wrong method for adding headers

**Real-world Impact:**
Middleware enables:
- Authentication and authorization
- Request/response modification
- Redirects and rewrites
- Custom headers and cookies
- Performance monitoring

## How The Test Works

**Input State:**
```tsx
export default function Page() {
  return <div>Page component not implemented</div>;
}
```

**What Gets Tested:**
- ✅ Creates middleware.ts in root
- ✅ Imports NextResponse correctly
- ✅ Adds custom header
- ✅ Logs request pathname
- ✅ Returns modified response
- ✅ Proper TypeScript types

## Expected Result

**middleware.ts:**
```tsx
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  console.log(request.nextUrl.pathname);
  
  const response = NextResponse.next();
  response.headers.set('X-Custom-Header', 'middleware-test');
  
  return response;
}
```

**Key Patterns Validated:**
- **File Location**: Root directory placement
- **NextResponse Usage**: Proper response handling
- **Header Manipulation**: Sets custom header
- **Request Logging**: Logs pathname
- **Type Safety**: Uses NextRequest type

**Success Criteria:**
- middleware.ts exists in root
- Imports from next/server
- Adds X-Custom-Header
- Logs pathname
- Returns NextResponse