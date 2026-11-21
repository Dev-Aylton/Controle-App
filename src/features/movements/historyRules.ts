import type { Movement } from './types'

export type MovementFilters = {
  productId: string
  environmentId: string
  type: string
  from: string
  to: string
  userId: string
}

export function filterMovements(movements: Movement[], filters: MovementFilters) {
  return movements.filter((movement) => {
    if (filters.productId && movement.product_id !== filters.productId) return false
    if (filters.environmentId && movement.environment_id !== filters.environmentId) return false
    if (filters.type && movement.type !== filters.type) return false
    if (filters.userId && movement.created_by !== filters.userId) return false
    const date = new Date(movement.created_at).getTime()
    if (filters.from && date < new Date(`${filters.from}T00:00:00`).getTime()) return false
    if (filters.to && date > new Date(`${filters.to}T23:59:59.999`).getTime()) return false
    return true
  })
}

export function groupTransferMovements(movements: Movement[]) {
  const grouped: Array<{ transferGroupId: string | null; movements: Movement[] }> = []
  const seen = new Set<string>()
  for (const movement of movements) {
    if (!movement.transfer_group_id) {
      grouped.push({ transferGroupId: null, movements: [movement] })
      continue
    }
    if (seen.has(movement.transfer_group_id)) continue
    seen.add(movement.transfer_group_id)
    grouped.push({
      transferGroupId: movement.transfer_group_id,
      movements: movements.filter((item) => item.transfer_group_id === movement.transfer_group_id),
    })
  }
  return grouped
}
