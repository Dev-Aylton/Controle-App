import { describe, expect, it } from 'vitest'
import { analyzeStockGap } from './stockGapAnalysis'

describe('análise de furo entre contagens', () => {
  it('detecta uma falta não explicada após venda de uma unidade', () => {
    const result = analyzeStockGap(5, 3, [{
      type: 'saida',
      quantity: 1,
      signed_quantity: -1,
      created_at: '2026-11-20T12:00:00Z',
      note: 'Venda: balcão',
      environment_id: 'bar',
    }])
    expect(result.expectedFinal).toBe(4)
    expect(result.unexplainedGap).toBe(-1)
    expect(result.status).toBe('loss')
  })

  it('não aponta furo quando contagem final coincide com todas as movimentações', () => {
    const result = analyzeStockGap(5, 4, [{
      type: 'saida',
      quantity: 1,
      signed_quantity: -1,
      created_at: '2026-11-20T12:00:00Z',
      note: 'Venda',
      environment_id: 'bar',
    }])
    expect(result.unexplainedGap).toBe(0)
    expect(result.status).toBe('ok')
  })

  it('considera entradas e transferências no saldo esperado', () => {
    const result = analyzeStockGap(5, 6, [
      { type: 'entrada', quantity: 3, signed_quantity: 3, created_at: '', note: null, environment_id: 'bar' },
      { type: 'transferencia_saida', quantity: 2, signed_quantity: -2, created_at: '', note: null, environment_id: 'bar' },
    ])
    expect(result.expectedFinal).toBe(6)
    expect(result.unexplainedGap).toBe(0)
  })

  it('considera ajuste positivo ou negativo do inventário', () => {
    const result = analyzeStockGap(5, 7, [
      { type: 'ajuste_inventario', quantity: 2, signed_quantity: 2, created_at: '', note: null, environment_id: 'bar' },
    ])
    expect(result.expectedFinal).toBe(7)
    expect(result.unexplainedGap).toBe(0)
  })
})
