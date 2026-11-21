import { createClient, type SupabaseClient } from '@supabase/supabase-js'
let cachedClient: SupabaseClient | null = null
let cachedUrl = ''
let cachedAnonKey = ''

function getConfig() {
  const isTest = import.meta.env.MODE === 'test'
  const url = isTest ? import.meta.env.VITE_SUPABASE_TEST_URL : import.meta.env.VITE_SUPABASE_URL
  const anonKey = isTest ? import.meta.env.VITE_SUPABASE_TEST_ANON_KEY : import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(isTest
      ? 'configure VITE_SUPABASE_TEST_URL e VITE_SUPABASE_TEST_ANON_KEY.'
      : 'configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }

  return { url, anonKey }
}

export function getSupabaseClient() {
  const { url, anonKey } = getConfig()
  if (cachedClient && cachedUrl === url && cachedAnonKey === anonKey) return cachedClient
  cachedClient = createClient(url, anonKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  cachedUrl = url
  cachedAnonKey = anonKey
  return cachedClient
}

export function prepareOAuthCallbackUrl() {
  if (typeof window === 'undefined') return

  const query = new URLSearchParams(window.location.search)
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const hashParts = hash.split('?')
  const hashParams = new URLSearchParams(hashParts[1] ?? (hash.includes('=') && !hash.startsWith('/') ? hash : ''))

  for (const key of ['code', 'error', 'error_description', 'error_code', 'state', 'access_token', 'refresh_token', 'expires_at']) {
    const value = query.get(key) ?? hashParams.get(key)
    if (value !== null) query.set(key, value)
  }

  const cleanHash = hashParts[0] ? `#${hashParts[0]}${hashParams.toString() ? '' : ''}` : '#/'
  if (!window.location.hash || !hash.includes('?')) return

  const nextUrl = `${window.location.pathname}${query.toString() ? `?${query.toString()}` : ''}${cleanHash}`
  window.history.replaceState(window.history.state, '', nextUrl)
}

export function clearOAuthCallbackParams() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  for (const key of ['code', 'error', 'error_description', 'error_code', 'state', 'access_token', 'refresh_token', 'expires_at']) {
    url.searchParams.delete(key)
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  try {
    return getConfig()
  } catch {
    return null
  }
}

export function tryGetSupabaseClient(): SupabaseClient | null {
  try {
    return getSupabaseClient()
  } catch {
    return null
  }
}

export async function checkSupabaseConnection(signal?: AbortSignal) {
  const { url, anonKey } = getConfig()

  const response = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
    headers: { apikey: anonKey },
    signal,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`serviço de autenticação respondeu HTTP ${response.status}.`)
  }
}
