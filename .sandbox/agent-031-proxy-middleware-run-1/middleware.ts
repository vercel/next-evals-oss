import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export function middleware(request: NextRequest) {
  console.log(`[middleware] pathname: ${request.nextUrl.pathname}`)

  const response = NextResponse.next()
  response.headers.set('X-Request-Id', generateRequestId())

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
