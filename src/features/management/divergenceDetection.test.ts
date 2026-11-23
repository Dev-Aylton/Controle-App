import { describe, expect, it } from 'vitest'
import { calculateStockDivergence, formatStockDivergenceMessage } from './divergenceDetection'

describe('detecção de divergência de estoque', () => {
  it('detecta 55 retiradas quando havia apenas 50', () => {
    const divergence = calculateStockDivergence(50, 55, 'sale_above_stock')
    expect(divergence?.excess).toBe(5)
  })

  it('não gera divergência quando informado dentro do disponível', () => {
    expect(calculateStockDivergence(50, 55, 'sale_above_stock')).not.toBeNull()
    expect(calculateStockDivergence(50, 50, 'sale_above_stock')).toBeNull()
    expect(calculateStockDivergence(50, 20, 'sale_above_stock')).toBeNull()
  })

  it('gera texto direto para investigação', () => {
    const divergence = calculateStockDivergence(50, 55, 'sale_above_stock')!
    expect(formatStockDivergenceMessage(divergence).toLowerCase()).toContain('5 unidade(s)')
  })
})
