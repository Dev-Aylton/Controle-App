import { detectPerishableProduct } from './stockSuggestions'

export type PurchasePlanningRow = {
  product_id: string
  product_name: string
  environment_id: string
  environment_name: string
  balance: number
  min_stock: number
  max_stock: number | null
  suggested_qty: number
  unit_cost: number | null
  estimated_cost: number | null
}

export type PurchaseProductPlan = {
  productId: string
  productName: string
  companyBalance: number
  unitCost: number | null
  totalNeed: number
  transferable: number
  purchaseQuantity: number
  perishable: boolean
  recommendedOrderQuantity: number
  environments: Array<{
    id: string
    name: string
    balance: number
    minStock: number
    maxStock: number | null
    need: number
    surplus: number
  }>
}

export function planPurchaseRows(rows: PurchasePlanningRow[]): PurchaseProductPlan[] {
  const grouped = new Map<string, PurchasePlanningRow[]>()
  for (const row of rows) {
    const group = grouped.get(row.product_id) ?? []
    group.push(row)
    grouped.set(row.product_id, group)
  }

  return [...grouped.entries()].map(([productId, items]) => {
    const environments = items.map((row) => {
      const target = row.max_stock ?? row.min_stock
      const need = target > row.balance ? target - row.balance : 0
      const thresholdSurplus = row.max_stock == null ? row.min_stock : row.max_stock
      const surplus = row.balance > thresholdSurplus ? row.balance - thresholdSurplus : 0
      return {
        id: row.environment_id,
        name: row.environment_name,
        balance: row.balance,
        minStock: row.min_stock,
        maxStock: row.max_stock,
        need,
        surplus,
      }
    })
    const companyBalance = environments.reduce((sum, environment) => sum + environment.balance, 0)
    const totalNeed = environments.reduce((sum, environment) => sum + environment.need, 0)
    const transferable = environments.reduce((sum, environment) => sum + environment.surplus, 0)
    const purchaseQuantity = Math.max(0, totalNeed - transferable)
    const perishable = detectPerishableProduct(items[0]?.product_name ?? '')
    const recommendedOrderQuantity = perishable
      ? purchaseQuantity === 0 ? 0 : Math.max(1, Math.ceil(purchaseQuantity * 0.5))
      : purchaseQuantity
    const costs = items.map((item) => item.unit_cost).filter((cost): cost is number => cost != null)
    return {
      productId,
      productName: items[0]?.product_name ?? productId,
      companyBalance,
      unitCost: costs[0] ?? null,
      totalNeed,
      transferable,
      purchaseQuantity,
      perishable,
      recommendedOrderQuantity,
      environments,
    }
  }).sort((left, right) => left.productName.localeCompare(right.productName, 'pt-BR'))
}
