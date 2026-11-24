import { describe, expect, it } from 'vitest'
import { countProductsWithoutStock } from './homeMetrics'

describe('métricas do início', () => {
  it('conta produto sem saldo uma vez, mesmo em vários ambientes', () => {
    const rows = [
      { product_id: 'produto-a', total_balance: 0 },
      { product_id: 'produto-a', total_balance: 0 },
      { product_id: 'produto-b', total_balance: 3 },
      { product_id: 'produto-c', total_balance: 0 },
    ]
    expect(countProductsWithoutStock(rows)).toBe(2)
  })
})
