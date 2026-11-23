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

  for (const row of negative) {
    notifications.push({
      id: `negative:${row.product_id}:${row.environment_id}`,
      severity: 'critical',
      title: 'Saldo negativo',
      description: `${row.product_name} está com saldo ${row.balance} em ${row.environment_name}.`,
      route: '/estoque/saldo',
      routeLabel: 'Conferir saldo',
      createdAt: now,
    })
  }
  for (const row of environmentLow) {
    if (row.balance >= 0 && row.balance <= row.min_stock) {
      notifications.push({
        id: `low:${row.product_id}:${row.environment_id}`,
        severity: 'warning',
        title: 'Produto abaixo do mínimo',
        description: `${row.product_name} está em ${row.balance} em ${row.environment_name}; mínimo configurado: ${row.min_stock}.`,
        route: '/compras',
        routeLabel: 'Abrir lista de compras',
        createdAt: now,
      })
    }
  }
  for (const row of pendingLosses) {
    notifications.push({
      id: `loss:${row.movement_id}`,
      severity: 'warning',
      title: 'Perda sem motivo',
      description: `${row.product_name} teve uma perda de ${row.quantity} em ${row.environment_name}.`,
      route: '/movimentacoes',
      routeLabel: 'Informar motivo',
      createdAt: now,
    })
  }
  return notifications
}
