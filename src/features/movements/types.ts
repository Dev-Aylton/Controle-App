export type MovementType =
  | 'entrada'
  | 'saida'
  | 'perda'
  | 'ajuste_inventario'
  | 'transferencia_saida'
  | 'transferencia_entrada'
  | 'estorno'
  | 'zeragem'

export type Movement = {
  id: string
  company_id: string
  product_id: string
  environment_id: string
  type: MovementType
  quantity: number
  signed_quantity: number
  note: string | null
  transfer_group_id: string | null
  reverses_movement_id: string | null
  inventory_session_id: string | null
  created_by: string | null
  created_at: string
  user_name?: string
  product_name?: string
  environment_name?: string
}

export type MovementProduct = {
  id: string
  name: string
  sku: string | null
  unit: string
  volume_ml?: number | null
  dose_ml?: number | null
  weight_g?: number | null
}

export type MovementEnvironment = {
  id: string
  name: string
}
