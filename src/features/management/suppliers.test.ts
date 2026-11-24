import { describe, expect, it } from 'vitest'
import { getCheapestSupplierPrice } from './suppliers'

describe('preços de fornecedores', () => {
  it('seleciona o menor preço atual do produto', () => {
    const price = getCheapestSupplierPrice([
      {
        id: 1,
        productId: 'p1',
        supplierId: 'a',
        unitPrice: 12,
        purchaseUnit: 'un',
        unitsPerPurchase: null,
        validFrom: '2026-11-20T10:00:00Z',
      },
      {
        id: 2,
        productId: 'p1',
        supplierId: 'b',
        unitPrice: 9.5,
        purchaseUnit: 'cx',
        unitsPerPurchase: 12,
        validFrom: '2026-11-21T10:00:00Z',
      },
      {
        id: 3,
        productId: 'p2',
        supplierId: 'c',
        unitPrice: 1,
        purchaseUnit: 'un',
        unitsPerPurchase: null,
        validFrom: '2026-11-21T10:00:00Z',
      },
    ], 'p1')
    expect(price?.supplierId).toBe('b')
  })
})
