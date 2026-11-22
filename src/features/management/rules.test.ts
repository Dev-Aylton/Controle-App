import { describe, expect, it } from 'vitest'
import { calculatePurchaseSuggestion, filterManagementAlerts, isLossReasonPending, validateStockRange } from './rules'

describe('regras da gestão', () => {
  it('calcula sugestão com máximo e mínimo', () => {
    expect(calculatePurchaseSuggestion(3, 5, 10)).toBe(7)
    expect(calculatePurchaseSuggestion(-1, 5, null)).toBe(6)
    expect(calculatePurchaseSuggestion(0, 5, null)).toBe(5)
  })
  it('valida estoque mínimo e máximo', () => {
    expect(validateStockRange(-1, 10)).toContain('mínimo')
    expect(validateStockRange(10, 5)).toContain('maior ou igual')
    expect(validateStockRange(5, 10)).toBeNull()
  })
  it('filtra itens da central', () => {
    const items = [{ balance: 0 }, { balance: -2 }, { balance: 5 }]
    expect(filterManagementAlerts(items, 'negativo', {
      abaixo: () => false,
      sem_estoque: (item) => item.balance === 0,
      negativo: (item) => item.balance < 0,
      perda: () => false,
      divergencia: () => false,
    })).toEqual([{ balance: -2 }])
  })
  it('marca perda sem motivo como pendente', () => {
    expect(isLossReasonPending(null)).toBe(true)
    expect(isLossReasonPending('')).toBe(true)
    expect(isLossReasonPending('reason-1')).toBe(false)
  })
})
