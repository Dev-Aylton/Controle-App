import { describe, expect, it } from 'vitest'
import { friendlySupabaseError, traduzirErro } from './errors'

describe('mensagens amigáveis', () => {
  it('traduz permission denied', () => {
    expect(friendlySupabaseError(new Error('permission denied for table memberships'))).toBe('Você não tem permissão para esta ação.')
  })

  it('traduz falha de rede', () => {
    expect(friendlySupabaseError(new Error('Failed to fetch'))).toBe('Sem conexão. Tente novamente.')
  })

  it('não expõe mensagem técnica desconhecida', () => {
    expect(friendlySupabaseError(new Error('Código inválido: public.secret_table'))).toBe('Código da empresa inválido ou trocado.')
  })

  it('traduz saldo e janela de correção sem vazar detalhe bruto', () => {
    expect(traduzirErro(new Error('saldo insuficiente no ambiente'))).toBe('Saldo insuficiente no ambiente.')
    expect(traduzirErro(new Error('15 minute correction window expired'))).toContain('15 minutos')
  })
})
