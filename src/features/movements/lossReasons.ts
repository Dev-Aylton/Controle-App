import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'

export type LossReason = { reason_id: string; name: string }
export type PendingLossMovement = {
  movement_id: string
  product_id: string
  product_name: string
  environment_id: string
  environment_name: string
  quantity: number
  created_at: string
}

export async function listLossReasons(companyId: string): Promise<LossReason[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('list_loss_reasons', { p_company_id: companyId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return (result.data ?? []) as LossReason[]
}

export async function completePendingLossReason(movementId: string, reasonId: string): Promise<void> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('complete_pending_loss_reason', {
    p_movement_id: movementId,
    p_reason_id: reasonId,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}

export async function getMyPendingLossReasons(companyId: string): Promise<PendingLossMovement[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('get_my_pending_loss_reasons', { p_company_id: companyId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return (result.data ?? []) as PendingLossMovement[]
}

export async function seedLossReasons(companyId: string): Promise<number> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('seed_loss_reasons', { p_company_id: companyId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return Number(result.data ?? 0)
}
