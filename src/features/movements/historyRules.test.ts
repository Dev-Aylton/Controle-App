import { describe, expect, it } from 'vitest'
import { filterMovements, groupTransferMovements } from './historyRules'
import type { Movement } from './types'

const movement = (overrides: Partial<Movement>): Movement => ({
  id: '1',
  company_id: 'company',
  product_id: 'product',
  environment_id: 'environment',
  type: 'entrada',
  quantity: 2,
  signed_quantity: 2,
  note: null,
  transfer_group_id: null,
  reverses_movement_id: null,
  inventory_session_id: null,
  created_by: 'user',
  created_at: '2026-11-21T10:00:00Z',
  ...overrides,
})

describe('histórico de movimentações', () => {
  it('filtra por produto, ambiente, tipo e usuário', () => {
    const rows = [movement({ product_id: 'p1', environment_id: 'e1', type: 'saida', created_by: 'u1' })]
    expect(filterMovements(rows, { productId: 'p1', environmentId: 'e1', type: 'saida', from: '', to: '', userId: 'u1' })).toHaveLength(1)
  })

  it('agrupa as pernas de uma transferência', () => {
    const rows = [
      movement({ id: 'a', transfer_group_id: 't1', type: 'transferencia_saida', signed_quantity: -2 }),
      movement({ id: 'b', transfer_group_id: 't1', type: 'transferencia_entrada', signed_quantity: 2 }),
    ]
    expect(groupTransferMovements(rows)).toHaveLength(1)
    expect(groupTransferMovements(rows)[0].movements).toHaveLength(2)
  })

  it('mostra somente movimentos dentro do período', () => {
    const rows = [movement({ created_at: '2026-11-21T10:00:00Z' })]
    expect(filterMovements(rows, { productId: '', environmentId: '', type: '', from: '2026-11-20', to: '2026-11-21', userId: '' })).toHaveLength(1)
  })
})
