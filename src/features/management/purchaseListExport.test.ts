import { describe, expect, it } from 'vitest'
import { buildPurchaseListExportRows } from './purchaseListExport'

describe('exportação da lista de compras', () => {
  it('inclui fornecedor, unidade e valores editados e exclui itens fora da lista', () => {
    const rows = buildPurchaseListExportRows([
      {
        key: 'a',
        productName: 'Gelo',
        environmentName: 'Bar',
        quantity: 2,
        purchaseUnit: 'cx',
        supplierName: 'Fornecedor A',
        unitCost: 10,
        draftAction: 'comprar',
        manual: true,
      },
      {
        key: 'b',
        productName: 'Fora',
        environmentName: 'Bar',
        quantity: 1,
        unitCost: 5,
        draftAction: 'fora',
        manual: true,
      },
    ])
    expect(rows).toEqual(expect.arrayContaining([
      expect.arrayContaining(['Fornecedor', 'Custo unitário', 'Ação']),
      expect.arrayContaining(['Gelo', 'Bar', 2, 'cx', 'Fornecedor A', 10, 20, 'Comprar']),
    ]))
    expect(rows.some((row) => row[0] === 'Fora')).toBe(false)
  })

  it('neutraliza textos que poderiam iniciar fórmulas', () => {
    const rows = buildPurchaseListExportRows([
      {
        key: 'formula',
        productName: '=1+1',
        environmentName: '@Bar',
        quantity: 1,
        supplierName: '+Fornecedor',
        unitCost: 10,
        draftAction: 'comprar',
        manual: true,
      },
    ])
    expect(rows[1]).toEqual(expect.arrayContaining(["'=1+1", "'@Bar", "'+Fornecedor"]))
  })
})
