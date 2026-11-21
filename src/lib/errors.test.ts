import { describe, expect, it } from 'vitest'
import { friendlySupabaseError } from './errors'

describe('mensagens amigáveis', () => {
  it('traduz permission denied', () => {
    expect(friendlySupabaseError(new Error('permission denied for table memberships'))).toBe('Você não tem permissão para esta ação.')
  })

  it('traduz falha de rede', () => {
    expect(friendlySupabaseError(new Error('Failed to fetch'))).toBe('Não foi possível conectar ao Supabase. Verifique sua internet.')
  })

  it('mantém mensagem desconhecida', () => {
    expect(friendlySupabaseError(new Error('Código inválido'))).toBe('Código inválido')
  })
})
