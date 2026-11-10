import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  console.log(request.nextUrl.pathname)

  const response = NextResponse.next()
  response.headers.set('X-Request-Id', crypto.randomUUID())

  return response
}
