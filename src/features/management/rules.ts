export type AlertFilter = 'abaixo' | 'sem_estoque' | 'negativo' | 'perda' | 'divergencia'

export function calculatePurchaseSuggestion(balance: number, minStock: number, maxStock: number | null): number {
  if (balance >= 0 && balance > minStock) return 0
  if (maxStock !== null) return Math.max(0, maxStock - balance)
  return Math.max(1, minStock - balance)
}

export function validateStockRange(minStock: number | null, maxStock: number | null): string | null {
  if (minStock !== null && minStock < 0) return 'Estoque mínimo não pode ser negativo.'
  if (maxStock !== null && maxStock < 0) return 'Estoque máximo não pode ser negativo.'
  if (minStock !== null && maxStock !== null && maxStock < minStock) return 'Estoque máximo deve ser maior ou igual ao mínimo.'
  return null
}

export function filterManagementAlerts<T>(
  items: T[],
  filter: AlertFilter,
  predicates: Record<AlertFilter, (item: T) => boolean>,
) {
  return items.filter(predicates[filter])
}

export function isLossReasonPending(reasonId: string | null): boolean {
  return !reasonId
}
