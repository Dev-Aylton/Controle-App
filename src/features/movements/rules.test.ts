import { describe, expect, it } from 'vitest'
import { movementSignedQuantity, canReverseMovement, formatMovementQuantity } from './rules'

describe('regras de movimentações', () => {
  it('calcula sinal por tipo', () => {
    expect(movementSignedQuantity('entrada', 5)).toBe(5)
    expect(movementSignedQuantity('saida', 5)).toBe(-5)
    expect(movementSignedQuantity('perda', 2)).toBe(-2)
    expect(movementSignedQuantity('ajuste_inventario', 1, 3)).toBe(3)
  })

  it('permite estorno próprio somente em 15 minutos', () => {
    const now = new Date('2026-11-21T12:00:00Z')
    expect(canReverseMovement('2026-11-21T11:50:00Z', now, false, true)).toBe(true)
    expect(canReverseMovement('2026-11-21T11:44:59Z', now, false, true)).toBe(false)
    expect(canReverseMovement('2026-11-21T11:44:59Z', now, true, false)).toBe(true)
  })

  it('formata quantidade', () => {
    expect(formatMovementQuantity(12.5)).toBe('12,5')
  })
})
