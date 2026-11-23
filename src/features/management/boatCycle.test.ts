import { describe, expect, it } from 'vitest'
import {
  analyzeBoatCycle,
  calculateBoatCycleFromMovements,
} from './boatCycle'

describe('ciclo diário de estoque entre ambientes', () => {
  it('detecta retirada, venda, devolução e saldo final correto', () => {
    const result = analyzeBoatCycle(0, 50, 40, 2, 8, 0)
    expect(result.expectedDestinationBalance).toBe(0)
    expect(result.status).toBe('ok')
  })

  it('detecta sobra não explicada no ambiente de destino', () => {
    const result = analyzeBoatCycle(0, 50, 40, 2, 5, 5)
    expect(result.expectedDestinationBalance).toBe(3)
    expect(result.unexplainedDifference).toBe(2)
    expect(result.status).toBe('surplus')
  })

  it('detecta falta no ambiente além das operações registradas', () => {
    const result = analyzeBoatCycle(0, 50, 40, 2, 8, 0)
    expect(result.expectedDestinationBalance).toBe(0)
  })

  it('identifica unidades sem explicação no ambiente de destino', () => {
    const result = analyzeBoatCycle(0, 10, 5, 0, 3, 0)
    expect(result.expectedDestinationBalance).toBe(2)
    expect(result.unexplainedDifference).toBe(-2)
    expect(result.status).toBe('missing')
  })

  it('explica compra direta no ambiente de destino sem falso positivo de sobra', () => {
    const result = analyzeBoatCycle(0, 10, 5, 0, 18, 17, 0, 30)
    expect(result.directPurchase).toBe(30)
    expect(result.expectedDestinationBalance).toBe(17)
    expect(result.unexplainedDifference).toBe(0)
    expect(result.status).toBe('ok')
  })

  it('calcula movimentações reais do ambiente de destino', () => {
    const result = calculateBoatCycleFromMovements([
      { type: 'transferencia_entrada', quantity: 50, signed_quantity: 50, environment_id: 'destino', transfer_group_id: 'g1', created_at: '2026-11-23T08:00:00Z', note: 'Retirada para ambiente de destino' },
      { type: 'saida', quantity: 40, signed_quantity: -40, environment_id: 'destino', transfer_group_id: null, created_at: '2026-11-23T20:00:00Z', note: 'Venda no ambiente de destino' },
      { type: 'perda', quantity: 2, signed_quantity: -2, environment_id: 'destino', transfer_group_id: null, created_at: '2026-11-23T20:10:00Z', note: 'Perda no ambiente de destino' },
      { type: 'transferencia_saida', quantity: 8, signed_quantity: -8, environment_id: 'destino', transfer_group_id: 'g2', created_at: '2026-11-23T21:00:00Z', note: 'Devolução ao ambiente de origem' },
    ], 'destino', 0, 0)
    expect(result.withdrawn).toBe(50)
    expect(result.sold).toBe(40)
    expect(result.losses).toBe(2)
    expect(result.returned).toBe(8)
    expect(result.status).toBe('ok')
  })
})
