export type PurchaseDraftItem = {
  key: string
  productName: string
  environmentName: string
  quantity: number
  unitCost: number | null
  manual: boolean
}

export function calculatePurchaseDraftEstimated(item: PurchaseDraftItem) {
  if (item.unitCost === null || !Number.isFinite(item.unitCost)) return null
  return Math.round((Math.max(0, item.quantity) * item.unitCost + Number.EPSILON) * 100) / 100
}

export function calculatePurchaseDraftTotal(items: PurchaseDraftItem[]) {
  let hasMissingCost = false
  let total = 0
  for (const item of items) {
    if (item.quantity <= 0) continue
    const estimated = calculatePurchaseDraftEstimated(item)
    if (estimated === null) hasMissingCost = true
    else total += estimated
  }
  return { total, hasMissingCost }
}
