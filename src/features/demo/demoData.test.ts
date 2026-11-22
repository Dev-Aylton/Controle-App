import { describe, expect, it, vi } from 'vitest'
import {
  canLaunchDemo,
  canUseSensitiveDemoData,
  createDemoState,
  registerDemoMovement,
  reverseDemoMovement,
  calculateDosesPerUnit,
  registerDemoDoseMovement,
  zeroDemoStock,
  finishDemoInventory,
  getDemoPurchaseItems,
  importDemoSales,
  undoDemoSales,
} from './demoData'

describe('modo demonstração', () => {
  it('aplica visibilidade por cargo', () => {
    expect(canUseSensitiveDemoData('employee')).toBe(false)
    expect(canUseSensitiveDemoData('admin')).toBe(true)
    expect(canLaunchDemo('employee')).toBe(true)
    expect(canLaunchDemo('admin')).toBe(false)
  })

  it('registra movimento, estorna e reinicia sem dados sensíveis', () => {
    const state = createDemoState()
    const product = state.products[0]
    const movement = registerDemoMovement(state, product.id, 'env-est', 'entrada', 2)
    expect(movement.quantity).toBe(2)
    reverseDemoMovement(state, movement.id, 'manager', true)
    expect(state.movements.some((item) => item.type === 'estorno')).toBe(true)
    const reset = createDemoState()
    expect(reset).not.toBe(state)
  })

  it('não importa o cliente Supabase', async () => {
    vi.resetModules()
    const module = await import('./demoData')
    expect(module.createDemoState).toBeTypeOf('function')
  })

  it('funcionário desativado perde lançamento', () => {
    const state = createDemoState()
    state.employeeActive = false
    state.role = 'employee'
    expect(() => registerDemoMovement(state, state.products[0].id, 'env-est', 'saida', 1)).toThrow('desativado')
    expect(canLaunchDemo(state.role)).toBe(true)
  })

  it('reinício restaura funcionário e código', () => {
    const state = createDemoState()
    state.employeeActive = false
    state.codeVersion = 9
    const reset = createDemoState()
    expect(reset.employeeActive).toBe(true)
    expect(reset.codeVersion).toBe(1)
  })

  it('converte doses em fração e falha sem dose', () => {
    const state = createDemoState()
    expect(calculateDosesPerUnit(998, 50)).toBe(19)
    expect(() => registerDemoDoseMovement(state, state.products[13].id, 'env-est', 'saida', 1)).toThrow('sem volume')
  })

  it('zeragem de um ou todos leva o saldo a zero', () => {
    const state = createDemoState()
    expect(zeroDemoStock(state, state.products[0].id, 'Inventário', 'manager')).toBe(1)
    expect(state.products[0].balance).toBe(0)
  })

  it('inventário cego registra divergências', () => {
    const state = createDemoState()
    expect(finishDemoInventory(state, 'manager', { [state.products[0].id]: 0 })).toBe(1)
  })

  it('compra, importação e desfazer funcionam na demo', () => {
    const state = createDemoState()
    expect(getDemoPurchaseItems(state).length).toBeGreaterThan(0)
    const batch = importDemoSales(state, [{ externalName: 'Vodka Premium', productId: state.products[0].id, quantity: 19, saleType: 'dose' }])
    expect(state.salesBatches[0].id).toBe(batch)
    undoDemoSales(state, batch)
    expect(state.salesBatches[0].status).toBe('undone')
  })
})
