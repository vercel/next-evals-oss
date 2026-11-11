import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  console.log('Request pathname:', request.nextUrl.pathname)

  const response = NextResponse.next()
  response.headers.set('X-Request-Id', randomUUID())
  return response
}
