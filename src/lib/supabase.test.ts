import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkSupabaseConnection } from './supabase'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('checkSupabaseConnection', () => {
  it('informa quando a configuração está ausente', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://production.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'production-key')
    vi.stubEnv('VITE_SUPABASE_TEST_URL', '')
    vi.stubEnv('VITE_SUPABASE_TEST_ANON_KEY', '')
    await expect(checkSupabaseConnection()).rejects.toThrow('configure VITE_SUPABASE_TEST_URL')
  })

  it('verifica o serviço de autenticação com a chave pública', async () => {
    vi.stubEnv('VITE_SUPABASE_TEST_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_TEST_ANON_KEY', 'public-key')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await expect(checkSupabaseConnection()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/settings',
      expect.objectContaining({ headers: { apikey: 'public-key' } }),
    )
  })

  it('informa uma resposta de erro do serviço', async () => {
    vi.stubEnv('VITE_SUPABASE_TEST_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_TEST_ANON_KEY', 'public-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))

    await expect(checkSupabaseConnection()).rejects.toThrow('HTTP 401')
  })
})
