export type LowStockAlert = {
  product_id: string
  product_name: string
  total_balance: number
  min_stock: number
  max_stock: number | null
  suggested_qty: number
  unit_cost: number | null
  estimated_cost: number | null
}

export type NegativeBalance = {
  product_id: string
  product_name: string
  environment_id: string
  environment_name: string
  balance: number
}

export type EnvironmentLowStock = {
  product_id: string
  product_name: string
  environment_id: string
  environment_name: string
  balance: number
  total_balance: number
  min_stock: number
}

export type PendingLoss = {
  movement_id: string
  product_id: string
  product_name: string
  environment_id: string
  environment_name: string
  quantity: number
  created_at: string
  created_by: string | null
}

export type PurchaseItem = {
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

export type AuditRow = {
  action: string
  object_name: string
  user_name: string
  created_at: string
  summary: string
  acted_as_support: boolean
}

export type MovementReportRow = {
  product_id: string
  product_name: string
  environment_id: string
  environment_name: string
  entradas: number
  saidas: number
  perdas: number
  transferencias_saida: number
  transferencias_entrada: number
  ajustes: number
  estornos: number
}
