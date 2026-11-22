import { describe, expect, it } from 'vitest'
import { buildConfirmDescription } from './confirmRules'

describe('ConfirmDialog', () => {
  it('explica a ação e a palavra exigida', () => {
    expect(buildConfirmDescription('excluir a conta', 'EXCLUIR')).toContain('EXCLUIR')
  })
  it('permite exigir palavra de confirmação', async () => {
    expect(buildConfirmDescription('excluir a conta', 'EXCLUIR')).toBe('Confirme excluir a conta digitando EXCLUIR.')
  })
})
