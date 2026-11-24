import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculatePurchaseDraftEstimated,
  calculatePurchaseDraftTotal,
  clearPurchaseDraft,
  getPurchaseDraftStorageKey,
  loadPurchaseDraft,
  savePurchaseDraft,
  validatePurchaseDraft,
} from './purchaseListDraft'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})

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

  it('calcula custo e mantém fornecedor/unidade na edição da lista', () => {
    const item = {
      key: 'vodka',
      productId: 'p1',
      productName: 'Vodka',
      environmentName: 'Estoque',
      quantity: 12,
      unitCost: 42,
      supplierId: 's1',
      supplierName: 'Distribuidora A',
      purchaseUnit: 'caixa',
      manual: false,
    }
    expect(calculatePurchaseDraftEstimated(item)).toBe(504)
  })

  it('bloqueia quantidade inválida e exige ao menos uma ação ativa', () => {
    expect(validatePurchaseDraft([
      { key: '1', productName: 'Vodka', environmentName: 'Estoque', quantity: 0, unitCost: 10, manual: false, draftAction: 'comprar' },
    ]).valid).toBe(false)
    expect(validatePurchaseDraft([
      { key: '1', productName: 'Vodka', environmentName: 'Estoque', quantity: 2, unitCost: 10, manual: false, draftAction: 'fora' },
    ]).valid).toBe(false)
  })

  it('salva, restaura e limpa rascunho isolado por empresa e usuário', () => {
    const items = [{
      key: 'vodka',
      productId: 'p1',
      productName: 'Vodka',
      environmentName: 'Estoque',
      quantity: 8,
      unitCost: 42,
      draftAction: 'comprar' as const,
      manual: false,
    }]
    savePurchaseDraft('company-a', 'user-a', items)
    expect(loadPurchaseDraft('company-a', 'user-a')).toEqual(items)
    expect(loadPurchaseDraft('company-b', 'user-a')).toEqual([])
    expect(getPurchaseDraftStorageKey('company-a', 'user-a')).toContain('company-a')
    clearPurchaseDraft('company-a', 'user-a')
    expect(loadPurchaseDraft('company-a', 'user-a')).toEqual([])
  })
})
