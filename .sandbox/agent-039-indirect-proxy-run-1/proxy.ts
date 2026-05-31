import type { ProxyRequest } from 'next/server'

export default function proxy(request: ProxyRequest) {
  console.log(`[Proxy] ${request.method} ${request.url}`)
}
