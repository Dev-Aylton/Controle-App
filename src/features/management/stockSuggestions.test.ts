import { describe, expect, it } from 'vitest'
import {
  analyzeReplenishmentPattern,
  calculateStockLevels,
  detectPerishableProduct,
} from './stockSuggestions'

describe('sugestão de estoque', () => {
  it('arredonda mínimo para 2 dias e máximo para 7 dias', () => {
    expect(calculateStockLevels(1.2)).toEqual({ minimum: 3, maximum: 9 })
  })

  it('classifica carnes, frutas e peixes como perecíveis', () => {
    expect(detectPerishableProduct('Picanha', 'Carnes')).toBe(true)
    expect(detectPerishableProduct('Banana', 'Frutas')).toBe(true)
    expect(detectPerishableProduct('Tilápia', 'Peixes')).toBe(true)
  })

  it('mantém estoque pequeno para perecíveis com compras frequentes', () => {
    const pattern = analyzeReplenishmentPattern(
      'Picanha',
      'Carnes',
      [
        { type: 'entrada', quantity: 10, created_at: '2026-11-01T10:00:00Z' },
        { type: 'saida', quantity: 8, created_at: '2026-11-03T10:00:00Z' },
        { type: 'entrada', quantity: 10, created_at: '2026-11-05T10:00:00Z' },
        { type: 'saida', quantity: 8, created_at: '2026-11-07T10:00:00Z' },
        { type: 'entrada', quantity: 10, created_at: '2026-11-09T10:00:00Z' },
      ],
      5,
      20,
    )
    expect(pattern.perishable).toBe(true)
    expect(pattern.action).toBe('keep')
  })

  it('sugere aumentar produto conservável com consumo recorrente', () => {
    const pattern = analyzeReplenishmentPattern(
      'Guardanapo',
      'Descartáveis',
      [
        { type: 'entrada', quantity: 100, created_at: '2026-11-01T10:00:00Z' },
        { type: 'entrada', quantity: 100, created_at: '2026-11-04T10:00:00Z' },
        { type: 'entrada', quantity: 100, created_at: '2026-11-07T10:00:00Z' },
        { type: 'saida', quantity: 90, created_at: '2026-11-08T10:00:00Z' },
      ],
      20,
      150,
    )
    expect(pattern.perishable).toBe(false)
    expect(pattern.action).toBe('increase')
  })
})
