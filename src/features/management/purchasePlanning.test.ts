import { describe, expect, it } from 'vitest'
import { paginatePurchasePlans, planPurchaseRows } from './purchasePlanning'

describe('planejamento consolidado de compras', () => {
  it('consolida ambientes e deduz quantidade transferível', () => {
    const plan = planPurchaseRows([
      {
        product_id: 'p1', product_name: 'Vodka', environment_id: 'bar',
        environment_name: 'Bar', balance: 2, min_stock: 5, max_stock: 10,
        suggested_qty: 8, unit_cost: 50, estimated_cost: 400,
      },
      {
        product_id: 'p1', product_name: 'Vodka', environment_id: 'estoque',
        environment_name: 'Estoque', balance: 12, min_stock: 5, max_stock: 15,
        suggested_qty: 3, unit_cost: 50, estimated_cost: 150,
      },
    ])

    expect(plan).toHaveLength(1)
    expect(plan[0].companyBalance).toBe(14)
    expect(plan[0].totalNeed).toBe(11)
    expect(plan[0].transferable).toBe(0)
    expect(plan[0].purchaseQuantity).toBe(11)
  })

  it('não sugere compra quando a empresa pode transferir o necessário', () => {
    const plan = planPurchaseRows([
      {
        product_id: 'p1', product_name: 'Gelo', environment_id: 'bar',
        environment_name: 'Bar', balance: 1, min_stock: 5, max_stock: 10,
        suggested_qty: 9, unit_cost: null, estimated_cost: null,
      },
      {
        product_id: 'p1', product_name: 'Gelo', environment_id: 'estoque',
        environment_name: 'Estoque', balance: 20, min_stock: 5, max_stock: 20,
        suggested_qty: 0, unit_cost: null, estimated_cost: null,
      },
    ])
    expect(plan[0].transferable).toBe(0)
    expect(plan[0].purchaseQuantity).toBe(9)
  })

  it('pagina listas grandes em blocos sem perder itens', () => {
    const items = Array.from({ length: 52 }, (_, index) => `item-${index + 1}`)
    expect(paginatePurchasePlans(items, 1, 25)).toEqual({
      page: 1,
      pageCount: 3,
      items: items.slice(0, 25),
    })
    expect(paginatePurchasePlans(items, 3, 25).items).toEqual(items.slice(50))
  })
})
