import { tryGetSupabaseClient } from '../lib/supabase'
import { friendlySupabaseError } from '../lib/errors'

export async function registerMovement(companyId: string, productId: string, environmentId: string, type: 'entrada'|'saida'|'perda', quantity: number, note?: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('register_movement', { p_company_id: companyId, p_product_id: productId, p_environment_id: environmentId, p_type: type, p_quantity: quantity, p_note: note ?? null })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data as string
}

export async function registerTransfer(companyId: string, productId: string, fromEnvironmentId: string, toEnvironmentId: string, quantity: number, note?: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('register_transfer', { p_company_id: companyId, p_product_id: productId, p_from_environment_id: fromEnvironmentId, p_to_environment_id: toEnvironmentId, p_quantity: quantity, p_note: note ?? null })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data as string
}

export async function reverseMovement(movementId: string, note?: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('reverse_movement', { p_movement_id: movementId, p_note: note ?? null })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data as string
}

export async function getStockBalance(companyId: string, environmentId?: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('get_stock_balance', { p_company_id: companyId, p_environment_id: environmentId ?? null })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return (result.data ?? []) as Array<{ product_id: string; environment_id: string; balance: number }>
}

export async function openInventory(companyId: string, environmentId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('open_inventory_session', { p_company_id: companyId, p_environment_id: environmentId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data as string
}

export async function submitInventoryCount(sessionId: string, productId: string, countedQuantity: number) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('submit_inventory_count', { p_session_id: sessionId, p_product_id: productId, p_counted_quantity: countedQuantity })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}

export async function finishInventory(sessionId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('finish_inventory_session', { p_session_id: sessionId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data
}
