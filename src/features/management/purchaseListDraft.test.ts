import { describe, expect, it } from 'vitest'
import { calculatePurchaseDraftEstimated, calculatePurchaseDraftTotal } from './purchaseListDraft'

describe('rascunho da lista de compras', () => {
  it('calcula o valor estimado de uma quantidade', () => {
    expect(calculatePurchaseDraftEstimated({
      key: '1',
      productName: 'Vodka',
      environmentName: 'Estoque',
      quantity: 6,
      unitCost: 89.9,
      manual: false,
    })).toBe(539.4)
  })

  it('indica custo ausente sem bloquear o total parcial', () => {
    const result = calculatePurchaseDraftTotal([
      { key: '1', productName: 'Vodka', environmentName: 'Estoque', quantity: 2, unitCost: 50, manual: false },
      { key: '2', productName: 'Gelo', environmentName: 'Bar', quantity: 3, unitCost: null, manual: true },
    ])
    expect(result.total).toBe(100)
    expect(result.hasMissingCost).toBe(true)
  })
})
