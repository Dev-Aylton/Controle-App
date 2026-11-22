import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'
import type {
  AuditRow,
  EnvironmentLowStock,
  LowStockAlert,
  MovementReportRow,
  NegativeBalance,
  PendingLoss,
  PurchaseItem,
} from './types'

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc(name, args)
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return (result.data ?? []) as T[]
}

export function getLowStockAlerts(companyId: string) {
  return rpc<LowStockAlert>('get_low_stock_alerts', { p_company_id: companyId })
}
export function getNegativeBalances(companyId: string) {
  return rpc<NegativeBalance>('get_negative_balances', { p_company_id: companyId })
}
export function getEnvironmentLowStock(companyId: string) {
  return rpc<EnvironmentLowStock>('get_environment_low_stock', { p_company_id: companyId })
}
export function getPendingLossReasons(companyId: string) {
  return rpc<PendingLoss>('get_pending_loss_reasons', { p_company_id: companyId })
}
export function getPurchaseList(companyId: string, environmentId: string | null = null) {
  return rpc<PurchaseItem>('get_purchase_list', { p_company_id: companyId, p_environment_id: environmentId })
}
export async function getInventoryValuation(companyId: string): Promise<number | null> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('get_inventory_valuation', { p_company_id: companyId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data == null ? null : Number(result.data)
}
export function getMovementReport(companyId: string, from: string, to: string, environmentId: string | null = null) {
  return rpc<MovementReportRow>('get_movement_report', {
    p_company_id: companyId, p_from: from, p_to: to, p_environment_id: environmentId,
  })
}
export function getAuditLog(companyId: string, from: string, to: string, limit = 200) {
  return rpc<AuditRow>('get_audit_log', { p_company_id: companyId, p_from: from, p_to: to, p_limit: limit })
}
