import type { CompanyRole } from '../lib/database.types'

export type MobileNavKey = 'home' | 'movements' | 'stock' | 'alerts' | 'inventory' | 'more'

export function getMobileNavItems(role: CompanyRole | null, isAdmin: boolean) {
  if (isAdmin || role === 'owner' || role === 'manager') {
    return [
      { key: 'home', label: 'Início', path: '/' },
      { key: 'movements', label: 'Mov.', path: '/movimentacoes' },
      { key: 'stock', label: 'Saldo', path: '/estoque/saldo' },
      { key: 'alerts', label: 'Alertas', path: '/alertas' },
      { key: 'more', label: 'Mais', path: '#' },
    ] as const
  }
  return [
    { key: 'home', label: 'Início', path: '/' },
    { key: 'movements', label: 'Mov.', path: '/movimentacoes' },
    { key: 'inventory', label: 'Inventário', path: '/inventario' },
    { key: 'more', label: 'Mais', path: '#' },
  ] as const
}

export function getNavigationIconLabel(key: MobileNavKey) {
  const labels: Record<MobileNavKey, string> = {
    home: 'Início',
    movements: 'Movimentações',
    stock: 'Saldo por ambiente',
    alerts: 'Alertas',
    inventory: 'Inventário',
    more: 'Mais opções',
  }
  return labels[key]
}
