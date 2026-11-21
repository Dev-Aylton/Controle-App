export function movementSignedQuantity(type: 'entrada' | 'saida' | 'perda' | 'ajuste_inventario' | 'transferencia_saida' | 'transferencia_entrada' | 'estorno', quantity: number, difference?: number) {
  if (type === 'entrada' || type === 'transferencia_entrada') return quantity
  if (type === 'saida' || type === 'perda' || type === 'transferencia_saida') return -quantity
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
