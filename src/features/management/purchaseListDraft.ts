export type PurchaseDraftItem = {
  key: string
  productId?: string
  productName: string
  environmentName: string
  quantity: number
  unitCost: number | null
  supplierId?: string
  supplierName?: string
  purchaseUnit?: string
  draftAction?: 'comprar' | 'transferir' | 'fora'
  manual: boolean
}

export type PurchaseDraftValidation = {
  valid: boolean
  message: string | null
  invalidItems: string[]
}

export function validatePurchaseDraft(items: PurchaseDraftItem[]): PurchaseDraftValidation {
  const invalidItems = items
    .filter((item) => item.quantity <= 0 || !Number.isFinite(item.quantity))
    .map((item) => item.productName)
  if (invalidItems.length > 0) {
    return {
      valid: false,
      message: 'Corrija as quantidades dos itens abaixo antes de continuar.',
      invalidItems,
    }
  }
  const activeItems = items.filter((item) => item.quantity > 0 && item.draftAction !== 'fora')
  if (activeItems.length === 0) {
    return {
      valid: false,
      message: 'Inclua ao menos um item para comprar ou transferir.',
      invalidItems: [],
    }
  }
  return { valid: true, message: null, invalidItems: [] }
}

export function getPurchaseDraftStorageKey(companyId: string, userId: string) {
  return `controle-app-purchase-draft:${companyId}:${userId}`
}

export function savePurchaseDraft(companyId: string, userId: string, items: PurchaseDraftItem[]) {
  localStorage.setItem(getPurchaseDraftStorageKey(companyId, userId), JSON.stringify(items))
}

export function loadPurchaseDraft(companyId: string, userId: string): PurchaseDraftItem[] {
  const raw = localStorage.getItem(getPurchaseDraftStorageKey(companyId, userId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as PurchaseDraftItem[] : []
  } catch {
    return []
  }
}

export function clearPurchaseDraft(companyId: string, userId: string) {
  localStorage.removeItem(getPurchaseDraftStorageKey(companyId, userId))
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
