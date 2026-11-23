import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'

export type PurchaseRequestItem = {
  product_id: string
  product_name: string
  sku: string | null
  quantity: number
  approved_quantity: number | null
}

export type PurchaseRequest = {
  id: string
  destination_environment_id: string
  destination_environment_name: string
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'atendida'
  note: string | null
  review_note: string | null
  created_at: string
  reviewed_at: string | null
  requested_by: string
  items: PurchaseRequestItem[]
}

export async function createPurchaseRequest(
  companyId: string,
  destinationEnvironmentId: string,
  items: Array<{ product_id: string; quantity: number }>,
  note?: string,
) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('create_purchase_request', {
    p_company_id: companyId,
    p_destination_environment_id: destinationEnvironmentId,
    p_items: items,
    p_note: note ?? null,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return String(result.data)
}

export async function listPurchaseRequests(companyId: string): Promise<PurchaseRequest[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('list_purchase_requests', { p_company_id: companyId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  const rows = Array.isArray(result.data)
    ? result.data
    : typeof result.data === 'string'
      ? JSON.parse(result.data)
      : result.data ?? []
  return (Array.isArray(rows) ? rows : []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    destination_environment_id: String(row.destination_environment_id),
    destination_environment_name: String(row.destination_environment_name),
    status: row.status as PurchaseRequest['status'],
    note: row.note == null ? null : String(row.note),
    review_note: row.review_note == null ? null : String(row.review_note),
    created_at: String(row.created_at),
    reviewed_at: row.reviewed_at == null ? null : String(row.reviewed_at),
    requested_by: String(row.requested_by),
    items: ((row.items as Array<Record<string, unknown>>) ?? []).map((item) => ({
      product_id: String(item.product_id),
      product_name: String(item.product_name),
      sku: item.sku == null ? null : String(item.sku),
      quantity: Number(item.quantity),
      approved_quantity: item.approved_quantity == null ? null : Number(item.approved_quantity),
    })),
  }))
}

export async function resolvePurchaseRequest(requestId: string, action: 'aprovar' | 'rejeitar', reviewNote?: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('resolve_purchase_request', {
    p_request_id: requestId,
    p_action: action,
    p_review_note: reviewNote ?? null,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}

export async function fulfillPurchaseRequest(requestId: string, sourceEnvironmentId: string, reviewNote?: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('fulfill_purchase_request', {
    p_request_id: requestId,
    p_source_environment_id: sourceEnvironmentId,
    p_review_note: reviewNote ?? null,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}
