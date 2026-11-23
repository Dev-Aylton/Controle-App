import {
  getEnvironmentLowStock,
  getNegativeBalances,
  getPendingLossReasons,
} from '../management/management'
import { tryGetSupabaseClient } from '../../lib/supabase'

export type AppNotificationSeverity = 'critical' | 'warning' | 'info'

export type AppNotification = {
  id: string
  severity: AppNotificationSeverity
  title: string
  description: string
  route: string
  routeLabel: string
  read: boolean
  dismissed: boolean
  createdAt: string
}

function storageKey(companyId: string, userId: string) {
  return `controle-app:notifications:${companyId}:${userId}`
}

type NotificationState = {
  readIds: string[]
  dismissedIds: string[]
}

export function loadNotificationState(companyId: string, userId: string): NotificationState {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(companyId, userId)) ?? '{}') as Partial<NotificationState>
    return {
      readIds: Array.isArray(saved.readIds) ? saved.readIds : [],
      dismissedIds: Array.isArray(saved.dismissedIds) ? saved.dismissedIds : [],
    }
  } catch {
    return { readIds: [], dismissedIds: [] }
  }
}

export function saveNotificationState(companyId: string, userId: string, state: NotificationState) {
  localStorage.setItem(storageKey(companyId, userId), JSON.stringify(state))
}

export async function getCompanyNotifications(companyId: string): Promise<Omit<AppNotification, 'read' | 'dismissed'>[]> {
  const [environmentLow, negative, pendingLosses] = await Promise.all([
    getEnvironmentLowStock(companyId),
    getNegativeBalances(companyId),
    getPendingLossReasons(companyId),
  ])
  const now = new Date().toISOString()
  const notifications: Omit<AppNotification, 'read' | 'dismissed'>[] = []
  const supabase = tryGetSupabaseClient()
  if (supabase) {
    const divergenceResult = await supabase.rpc('get_audit_log', {
      p_company_id: companyId,
      p_from: new Date(Date.now() - 30 * 86400000).toISOString(),
      p_to: now,
      p_limit: 200,
    })
    if (!divergenceResult.error) {
      const rows = (divergenceResult.data ?? []) as Array<{ action: string; summary: string; created_at: string }>
      for (const row of rows.filter((item) => item.action === 'stock_divergence_detected')) {
        notifications.push({
          id: `divergence:${row.created_at}:${row.summary}`,
          severity: 'critical',
          title: 'Divergência de estoque',
          description: row.summary,
          route: '/auditoria',
          routeLabel: 'Investigar auditoria',
          createdAt: row.created_at,
        })
      }
    }
  }

  if (negative.length) {
    notifications.push({
      id: 'negative:summary',
      severity: 'critical',
      title: `${negative.length} saldo(s) negativo(s)`,
      description: `${negative[0].product_name} em ${negative[0].environment_name} é o primeiro item da lista. Abra o saldo para revisar todos.`,
      route: '/estoque/saldo',
      routeLabel: 'Conferir saldos',
      createdAt: now,
    })
  }
  const lowRows = environmentLow.filter((row) => row.balance >= 0 && row.balance <= row.min_stock)
  if (lowRows.length) {
    notifications.push({
      id: 'low:summary',
      severity: 'warning',
      title: `${lowRows.length} produto(s) abaixo do mínimo`,
      description: `${lowRows[0].product_name} está em ${lowRows[0].environment_name}. Revise a lista consolidada antes de comprar ou transferir.`,
      route: '/compras',
      routeLabel: 'Abrir lista de compras',
      createdAt: now,
    })
  }
  if (pendingLosses.length) {
    notifications.push({
      id: 'loss:summary',
      severity: 'warning',
      title: `${pendingLosses.length} perda(s) sem motivo`,
      description: `${pendingLosses[0].product_name} em ${pendingLosses[0].environment_name} aguarda classificação. Revise todas as pendências juntas.`,
      route: '/movimentacoes',
      routeLabel: 'Informar motivos',
      createdAt: now,
    })
  }
  return notifications
}
