import { tryGetSupabaseClient } from '../../lib/supabase'
import { traduzirErro } from '../../lib/errors'
import { canManageCompany } from '../../lib/uiPermissions'
import type { CompanyRole } from '../../lib/database.types'
import { downloadCsv } from '../management/csv'
import { getLowStockAlerts, getMovementReport, getPurchaseList } from '../management/management'

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportPersonalData(userId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const [profile, memberships] = await Promise.all([
    supabase.from('profiles').select('id,name,avatar_url,avatar_key,created_at').eq('id', userId).single(),
    supabase.from('memberships').select('id,company_id,role,active,created_at').eq('user_id', userId),
  ])
  if (profile.error) throw new Error(traduzirErro(profile.error))
  if (memberships.error) throw new Error(traduzirErro(memberships.error))
  downloadJson(`controle-app-dados-pessoais-${new Date().toISOString().slice(0, 10)}.json`, {
    profile: profile.data,
    memberships: memberships.data ?? [],
  })
}

export async function exportCompanyData(companyId: string, companyName: string, role: CompanyRole | null, isAdmin: boolean) {
  if (!canManageCompany(role, isAdmin)) throw new Error('Você não tem permissão para esta ação.')
  const end = new Date()
  const start = new Date(end.getTime() - 30 * 86400000)
  const [alerts, purchases, report] = await Promise.all([
    getLowStockAlerts(companyId),
    getPurchaseList(companyId),
    getMovementReport(companyId, start.toISOString(), end.toISOString()),
  ])
  downloadCsv(`${companyName}-gestao-${end.toISOString().slice(0, 10)}.csv`, [
    ['Tipo', 'Produto', 'Ambiente', 'Saldo', 'Mínimo', 'Sugestão', 'Valor estimado'],
    ...alerts.map((row) => ['Alerta', row.product_name, '', row.total_balance, row.min_stock, row.suggested_qty, row.estimated_cost]),
    ...purchases.map((row) => ['Compra', row.product_name, row.environment_name, row.balance, row.min_stock, row.suggested_qty, row.estimated_cost]),
    ...report.map((row) => ['Movimentação', row.product_name, row.environment_name, '', '', '', `entradas=${row.entradas};saídas=${row.saidas}`]),
  ])
}
