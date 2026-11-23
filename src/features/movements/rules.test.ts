import { describe, expect, it } from 'vitest'
import {
  movementSignedQuantity,
  canReverseMovement,
  formatMovementQuantity,
  calculateDoseQuantity,
  calculatePortionQuantity,
  calculateWeightQuantity,
} from './rules'

describe('regras de movimentações', () => {
  it('calcula sinal por tipo', () => {
    expect(movementSignedQuantity('entrada', 5)).toBe(5)
    expect(movementSignedQuantity('saida', 5)).toBe(-5)
    expect(movementSignedQuantity('perda', 2)).toBe(-2)
    expect(movementSignedQuantity('ajuste_inventario', 1, 3)).toBe(3)
    expect(movementSignedQuantity('zeragem', 4)).toBe(-4)
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

  it('converte doses em fração da unidade', () => {
    expect(calculateDoseQuantity(1000, 50, 19)).toBe(0.95)
    expect(calculateDoseQuantity(998, 50, 19)).toBe(1)
  })

  it('converte porções de 200 g em 30 kg de estoque', () => {
    expect(calculatePortionQuantity(150, 'kg', 200)).toBe(30)
  })

  it('converte porções em unidades quando o produto é contado por porção', () => {
    expect(calculatePortionQuantity(150, 'porcao', 200)).toBe(150)
  })

  it('converte peso bruto em kg para unidade ou gramas conforme o cadastro', () => {
    expect(calculateWeightQuantity(3, 'kg', null)).toBe(3)
    expect(calculateWeightQuantity(3, 'g', null)).toBe(3000)
    expect(calculateWeightQuantity(3, 'porcao', 200)).toBe(15)
  })
})
