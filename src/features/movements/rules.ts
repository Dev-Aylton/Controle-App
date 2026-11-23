export function movementSignedQuantity(type: 'entrada' | 'saida' | 'perda' | 'ajuste_inventario' | 'transferencia_saida' | 'transferencia_entrada' | 'estorno' | 'zeragem', quantity: number, difference?: number) {
  if (type === 'entrada' || type === 'transferencia_entrada') return quantity
  if (type === 'saida' || type === 'perda' || type === 'transferencia_saida' || type === 'zeragem') return -quantity
  if (type === 'ajuste_inventario') return difference ?? quantity
  if (type === 'estorno') return -quantity
  return quantity
}

export function canReverseMovement(createdAt: string, now = new Date(), isOwnerOrManager = false, isOwn = false) {
  if (isOwnerOrManager) return true
  if (!isOwn) return false
  const age = now.getTime() - new Date(createdAt).getTime()
  return age >= 0 && age <= 15 * 60 * 1000
}

export function formatMovementQuantity(quantity: number) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(quantity)
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function calculateDoseQuantity(volumeMl: number | null, doseMl: number | null, doses: number): number | null {
  if (!volumeMl || !doseMl || volumeMl <= 0 || doseMl <= 0 || doses <= 0) return null
  const dosesPerUnit = Math.floor(volumeMl / doseMl)
  if (dosesPerUnit < 1) return null
  return Number((doses / dosesPerUnit).toFixed(3))
}

export function calculateWeightQuantity(weightKg: number, stockUnit: string, weightPerUnitG: number | null): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null
  if (stockUnit === 'kg') return Number(weightKg.toFixed(3))
  if (stockUnit === 'g') return Number((weightKg * 1000).toFixed(3))
  if (weightPerUnitG && weightPerUnitG > 0) {
    return Number(((weightKg * 1000) / weightPerUnitG).toFixed(3))
  }
  return null
}

export function calculatePortionQuantity(portions: number, stockUnit: string, weightPerUnitG: number | null): number | null {
  if (!Number.isFinite(portions) || portions <= 0) return null
  if (stockUnit === 'porcao' || stockUnit === 'peca' || stockUnit === 'un') return Number(portions.toFixed(3))
  if (!weightPerUnitG || weightPerUnitG <= 0) return null
  if (stockUnit === 'kg') return Number(((portions * weightPerUnitG) / 1000).toFixed(3))
  if (stockUnit === 'g') return Number((portions * weightPerUnitG).toFixed(3))
  return null
}
