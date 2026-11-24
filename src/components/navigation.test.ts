import { describe, expect, it } from 'vitest'
import { getNavigationGroups } from './navigation'

describe('navegação por cargo', () => {
  it('prioriza o fluxo diário para funcionário sem itens de gestão', () => {
    const groups = getNavigationGroups('employee', false)
    const paths = groups.flatMap((group) => group.items.map((item) => item.path))
    expect(groups[0]?.label).toBe('Meu trabalho')
    expect(paths).not.toContain('/auditoria')
    expect(paths).not.toContain('/vendas/importar')
    expect(paths.slice(0, 5)).toEqual(['/', '/movimentacoes', '/estoque/saldo', '/inventario', '/compras'])
  })

  it('agrupa gestão e comercial para gerente', () => {
    const groups = getNavigationGroups('manager', false)
    expect(groups.map((group) => group.label)).toEqual([
      'Visão geral',
      'Operação diária',
      'Cadastros',
      'Vendas',
      'Gestão',
      'Conta e ajuda',
    ])
  })

  it('oculta operação para conta ainda sem vínculo', () => {
    const paths = getNavigationGroups(null, false).flatMap((group) => group.items.map((item) => item.path))
    expect(paths).toEqual(['/', '/empresa', '/perfil', '/suporte'])
  })
})
