const appOrigins = new Set([
  'http://127.0.0.1:4173',
  'http://localhost:4173',
])

export function isBackendRequest(requestUrl: string) {
  const url = new URL(requestUrl)
  return !appOrigins.has(url.origin) || /^\/(?:auth|rest|storage|functions)\/v1(?:\/|$)/i.test(url.pathname)
}
